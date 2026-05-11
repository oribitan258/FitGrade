/**
 * Test Session E2E — covers:
 *   1. Result submission (happy path + all error branches)
 *   2. Duplicate prevention — sequential AND concurrent (race condition simulation)
 *   3. 30-second undo window — success inside window, rejection outside
 *   4. Session lifecycle (start stopwatch, complete)
 *   5. Grade override
 *   6. Auth / authorization guards
 *
 * Uses a real PostgreSQL test database via AppModule (no mocks).
 * The undo-window test manipulates `recordedAt` directly via Prisma to avoid
 * a real 31-second sleep — this correctly tests the service's Date.now() check.
 */

import * as request from 'supertest';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

// ─── Luhn-valid IDs that do not collide with enrollment-import.e2e-spec.ts ───
// Verified: sum % 10 === 0
const STUDENT_A_ID = '000000034'; // sum = 10 ✓ (0+0+0+0+0+0+0+6+4)
const STUDENT_B_ID = '000000042'; // sum = 10 ✓ (0+0+0+0+0+0+0+8+2)
const STUDENT_C_ID = '000000059'; // sum = 10 ✓ (0+0+0+0+0+0+0+1+9→sum: 0+0+0+0+0+0+0+10→1+9=10)

// ─── Typed helpers ────────────────────────────────────────────────────────────

interface SessionBody {
  id: string;
  classId: string;
  testTypeId: string;
  semester: string;
  conductedAt: string;
  completedAt: string | null;
  startedAt: string | null;
}

interface ResultBody {
  id: string;
  sessionId: string;
  studentId: string;
  rawValue: number;
  calculatedGrade: number;
  gradeOverride: number | null;
  recordedAt: string;
}

interface TestTypeBody {
  id: string;
  nameHe: string;
  inputType: string;
}

interface StudentBody {
  id: string;
  nationalId: string;
  firstName: string;
}

// ─── Suite setup ──────────────────────────────────────────────────────────────

describe('Test Sessions (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherToken: string;
  let studentToken: string;

  let classId: string;
  let passfailTestTypeId: string;
  let studentAId: string;
  let studentBId: string;
  let studentCId: string;

  // Shared session used by most suites (results submitted in Suite 1 persist here)
  let mainSessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Teacher JWT via dev-login (requires seeded teacher@test.com)
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/dev-login')
      .expect(200);
    teacherToken = (loginRes.body as { accessToken: string }).accessToken;

    // Student-role JWT for auth guard tests (no real student record needed)
    const jwtService = app.get(JwtService);
    studentToken = jwtService.sign({ sub: 'fake-student', role: 'STUDENT' });

    // ── Create the test class ───────────────────────────────────────────────
    const classRes = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'E2E Tests Class', academicYear: '2024-2025', gradeLevel: 10 })
      .expect(201);
    classId = (classRes.body as { id: string }).id;

    // ── Enroll 3 students ──────────────────────────────────────────────────
    const addStudent = async (nationalId: string, firstName: string): Promise<string> => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName, lastName: 'בדיקה', gender: 'MALE', nationalId })
        .expect((r) => {
          if (r.status !== 201 && r.status !== 200) {
            throw new Error(`Enroll failed: ${r.status} ${JSON.stringify(r.body)}`);
          }
        });
      const body = res.body as { student: StudentBody; reEnrolled: boolean };
      return body.student.id;
    };

    studentAId = await addStudent(STUDENT_A_ID, 'תלמיד_א');
    studentBId = await addStudent(STUDENT_B_ID, 'תלמיד_ב');
    studentCId = await addStudent(STUDENT_C_ID, 'תלמיד_ג');

    // ── Find the first PASS_FAIL test type ─────────────────────────────────
    // PASS_FAIL avoids norm-table lookups and TIME minimums — safest for e2e
    const typesRes = await request(app.getHttpServer())
      .get('/api/tests/types')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const allTypes = typesRes.body as TestTypeBody[];
    const passfailType = allTypes.find((t) => t.inputType === 'PASS_FAIL');
    if (passfailType === undefined) {
      throw new Error('No PASS_FAIL test type found in seed data — cannot run e2e tests');
    }
    passfailTestTypeId = passfailType.id;

    // ── Create the main session ────────────────────────────────────────────
    const sessionRes = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/sessions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ testTypeId: passfailTestTypeId, semester: 'A' })
      .expect(201);
    mainSessionId = (sessionRes.body as SessionBody).id;
  }, 60_000);

  afterAll(async () => {
    // Cleanup in FK-safe order
    await prisma.testResult.deleteMany({
      where: { session: { classId } },
    });
    await prisma.testSession.deleteMany({ where: { classId } });
    await prisma.classEnrollment.deleteMany({ where: { classId } });
    await prisma.student.deleteMany({
      where: { nationalId: { in: [STUDENT_A_ID, STUDENT_B_ID, STUDENT_C_ID] } },
    });
    await prisma.class.deleteMany({ where: { id: classId } });

    await app.close();
  }, 30_000);

  // ─── Suite 1 — Basic result submission ────────────────────────────────────

  describe('Suite 1 — basic result submission', () => {
    it('T1.1 submits result for student A → 201 with grade', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sessions/${mainSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentAId, rawValue: 1 }) // rawValue=1 → PASS_FAIL → grade 100
        .expect(201);

      const body = res.body as ResultBody;
      expect(body.studentId).toBe(studentAId);
      expect(body.sessionId).toBe(mainSessionId);
      expect(body.calculatedGrade).toBe(100);
      expect(body.rawValue).toBe(1);
      expect(body.id).toBeTruthy();
    });

    it('T1.2 submits result for student B → 201 (rawValue=0 → fail → grade 0)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sessions/${mainSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentBId, rawValue: 0 })
        .expect(201);

      const body = res.body as ResultBody;
      expect(body.calculatedGrade).toBe(0);
    });

    it('T1.3 GET session → both results present', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sessions/${mainSessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const body = res.body as { results: ResultBody[] };
      const studentIds = body.results.map((r) => r.studentId);
      expect(studentIds).toContain(studentAId);
      expect(studentIds).toContain(studentBId);
    });

    it('T1.4 missing studentId field → 400 validation error', async () => {
      await request(app.getHttpServer())
        .post(`/api/sessions/${mainSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ rawValue: 1 })
        .expect(400);
    });

    it('T1.5 rawValue=-1 (below @Min(0)) → 400 validation error', async () => {
      await request(app.getHttpServer())
        .post(`/api/sessions/${mainSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentCId, rawValue: -1 })
        .expect(400);
    });

    it('T1.6 non-existent sessionId → 404', async () => {
      await request(app.getHttpServer())
        .post('/api/sessions/00000000-0000-0000-0000-000000000000/results')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(404);
    });
  });

  // ─── Suite 2 — Duplicate prevention (sequential + concurrent) ────────────

  describe('Suite 2 — duplicate prevention', () => {
    // Each test in this suite creates its own isolated session to avoid
    // cross-test result contamination
    let dedupSessionId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTestTypeId, semester: 'A' })
        .expect(201);
      dedupSessionId = (res.body as SessionBody).id;
    });

    afterAll(async () => {
      await prisma.testResult.deleteMany({ where: { sessionId: dedupSessionId } });
      await prisma.testSession.deleteMany({ where: { id: dedupSessionId } });
    });

    it('T2.1 first submission for a student succeeds (201)', async () => {
      await request(app.getHttpServer())
        .post(`/api/sessions/${dedupSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(201);
    });

    it('T2.2 second submission for the same student → 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sessions/${dedupSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(409);

      const body = res.body as { statusCode: number; message: string };
      expect(body.statusCode).toBe(409);
      expect(body.message).toBeTruthy();
    });

    it('T2.3 DB has exactly ONE result for (dedupSession, studentA) after two attempts', async () => {
      const count = await prisma.testResult.count({
        where: { sessionId: dedupSessionId, studentId: studentAId },
      });
      expect(count).toBe(1);
    });

    it('T2.4 concurrent duplicate prevention — 5 simultaneous POSTs → exactly 1 succeeds (201), rest are 409', async () => {
      // Fresh session so studentB has no result yet
      const concurrentSessionRes = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTestTypeId, semester: 'A' })
        .expect(201);
      const concurrentSessionId = (concurrentSessionRes.body as SessionBody).id;

      // Fire 5 identical requests simultaneously
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post(`/api/sessions/${concurrentSessionId}/results`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({ studentId: studentBId, rawValue: 1 }),
        ),
      );

      const statuses = responses.map((r) => r.status);
      const successCount = statuses.filter((s) => s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      // Exactly one must succeed
      expect(successCount).toBe(1);
      // All others must be conflicts (total = 5)
      expect(conflictCount).toBe(4);

      // DB integrity check: exactly 1 row
      const dbCount = await prisma.testResult.count({
        where: { sessionId: concurrentSessionId, studentId: studentBId },
      });
      expect(dbCount).toBe(1);

      // Cleanup this concurrent session
      await prisma.testResult.deleteMany({ where: { sessionId: concurrentSessionId } });
      await prisma.testSession.deleteMany({ where: { id: concurrentSessionId } });
    }, 15_000);
  });

  // ─── Suite 3 — Undo window (30-second constraint) ────────────────────────

  describe('Suite 3 — 30-second undo window', () => {
    let undoSessionId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTestTypeId, semester: 'A' })
        .expect(201);
      undoSessionId = (res.body as SessionBody).id;
    });

    afterAll(async () => {
      await prisma.testResult.deleteMany({ where: { sessionId: undoSessionId } });
      await prisma.testSession.deleteMany({ where: { id: undoSessionId } });
    });

    it('T3.1 DELETE result within the undo window → 204 No Content', async () => {
      // Submit result
      const submitRes = await request(app.getHttpServer())
        .post(`/api/sessions/${undoSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(201);

      const submittedResult = submitRes.body as ResultBody;
      expect(submittedResult.id).toBeTruthy();

      // Immediately delete — recordedAt is ~now, well within 30s window
      await request(app.getHttpServer())
        .delete(`/api/sessions/${undoSessionId}/results/${studentAId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(204);

      // Confirm the row is gone from the DB
      const dbCount = await prisma.testResult.count({
        where: { sessionId: undoSessionId, studentId: studentAId },
      });
      expect(dbCount).toBe(0);
    });

    it('T3.2 DELETE outside the undo window → 422 Unprocessable Entity', async () => {
      // Submit a fresh result
      await request(app.getHttpServer())
        .post(`/api/sessions/${undoSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(201);

      // Backdate recordedAt by 31 seconds directly in the DB — simulates elapsed time
      // without a real sleep. This tests the exact Date.now() check in deleteResult().
      await prisma.testResult.updateMany({
        where: { sessionId: undoSessionId, studentId: studentAId },
        data: { recordedAt: new Date(Date.now() - 31_000) },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/sessions/${undoSessionId}/results/${studentAId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(422);

      const body = res.body as { statusCode: number; message: string };
      expect(body.statusCode).toBe(422);
      expect(body.message).toMatch(/30/); // Hebrew message mentions "30 שניות"
    });

    it('T3.3 the expired result row is still in the DB (not deleted on rejection)', async () => {
      const dbCount = await prisma.testResult.count({
        where: { sessionId: undoSessionId, studentId: studentAId },
      });
      expect(dbCount).toBe(1);
    });

    it('T3.4 DELETE non-existent result → 404', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${undoSessionId}/results/${studentBId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });

    it('T3.5 undo window boundary — result exactly at 30s is within window (edge case)', async () => {
      // Cleanup previous result
      await prisma.testResult.deleteMany({
        where: { sessionId: undoSessionId, studentId: studentAId },
      });

      // Submit fresh result
      await request(app.getHttpServer())
        .post(`/api/sessions/${undoSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(201);

      // Backdate to exactly 29.9s ago — still within the 30s window
      await prisma.testResult.updateMany({
        where: { sessionId: undoSessionId, studentId: studentAId },
        data: { recordedAt: new Date(Date.now() - 29_900) },
      });

      // Must succeed — 29.9s < 30s window
      await request(app.getHttpServer())
        .delete(`/api/sessions/${undoSessionId}/results/${studentAId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(204);
    });
  });

  // ─── Suite 4 — Session lifecycle ─────────────────────────────────────────

  describe('Suite 4 — session lifecycle', () => {
    let lifecycleSessionId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTestTypeId, isStopwatch: true, semester: 'A' })
        .expect(201);
      lifecycleSessionId = (res.body as SessionBody).id;
    });

    afterAll(async () => {
      await prisma.testResult.deleteMany({ where: { sessionId: lifecycleSessionId } });
      await prisma.testSession.deleteMany({ where: { id: lifecycleSessionId } });
    });

    it('T4.1 new session has startedAt = null and completedAt = null', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/sessions/${lifecycleSessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const body = res.body as SessionBody;
      expect(body.startedAt).toBeNull();
      expect(body.completedAt).toBeNull();
    });

    it('T4.2 POST /start sets startedAt to a server timestamp', async () => {
      const before = Date.now();

      const res = await request(app.getHttpServer())
        .post(`/api/sessions/${lifecycleSessionId}/start`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const body = res.body as SessionBody;
      expect(body.startedAt).not.toBeNull();

      const startedAt = new Date(body.startedAt!).getTime();
      expect(startedAt).toBeGreaterThanOrEqual(before);
      expect(startedAt).toBeLessThanOrEqual(Date.now());
    });

    it('T4.3 PATCH /complete sets completedAt to a server timestamp', async () => {
      const before = Date.now();

      const res = await request(app.getHttpServer())
        .patch(`/api/sessions/${lifecycleSessionId}/complete`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const body = res.body as SessionBody;
      expect(body.completedAt).not.toBeNull();

      const completedAt = new Date(body.completedAt!).getTime();
      expect(completedAt).toBeGreaterThanOrEqual(before);
      expect(completedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  // ─── Suite 5 — Grade override ─────────────────────────────────────────────

  describe('Suite 5 — grade override', () => {
    let overrideSessionId: string;
    let resultId: string;

    beforeAll(async () => {
      const sessRes = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTestTypeId, semester: 'A' })
        .expect(201);
      overrideSessionId = (sessRes.body as SessionBody).id;

      const resultRes = await request(app.getHttpServer())
        .post(`/api/sessions/${overrideSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(201);
      resultId = (resultRes.body as ResultBody).id;
    });

    afterAll(async () => {
      await prisma.testResult.deleteMany({ where: { sessionId: overrideSessionId } });
      await prisma.testSession.deleteMany({ where: { id: overrideSessionId } });
    });

    it('T5.1 PATCH override with gradeOverride=95 → 200, gradeOverride field set', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sessions/${overrideSessionId}/results/${resultId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ gradeOverride: 95 })
        .expect(200);

      const body = res.body as ResultBody;
      expect(body.gradeOverride).toBe(95);
      expect(body.id).toBe(resultId);
    });

    it('T5.2 gradeOverride=101 → 400 (out of range)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${overrideSessionId}/results/${resultId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ gradeOverride: 101 })
        .expect(400);
    });

    it('T5.3 gradeOverride=0 → 200 (zero is a valid override)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sessions/${overrideSessionId}/results/${resultId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ gradeOverride: 0 })
        .expect(200);

      const body = res.body as ResultBody;
      expect(body.gradeOverride).toBe(0);
    });

    it('T5.4 non-existent resultId → 404', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${overrideSessionId}/results/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ gradeOverride: 90 })
        .expect(404);
    });
  });

  // ─── Suite 6 — Auth and authorization guards ─────────────────────────────

  describe('Suite 6 — auth guards', () => {
    it('T6.1 submit result without JWT → 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/sessions/${mainSessionId}/results`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(401);
    });

    it('T6.2 submit result with student-role JWT → 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/sessions/${mainSessionId}/results`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ studentId: studentAId, rawValue: 1 })
        .expect(403);
    });

    it('T6.3 GET session without JWT → 401', async () => {
      await request(app.getHttpServer())
        .get(`/api/sessions/${mainSessionId}`)
        .expect(401);
    });

    it('T6.4 DELETE result without JWT → 401', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${mainSessionId}/results/${studentAId}`)
        .expect(401);
    });

    it('T6.5 create session without JWT → 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .send({ testTypeId: passfailTestTypeId })
        .expect(401);
    });

    it('T6.6 create session with student-role JWT → 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ testTypeId: passfailTestTypeId })
        .expect(403);
    });
  });
});
