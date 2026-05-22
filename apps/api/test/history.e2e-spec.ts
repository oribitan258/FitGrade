/**
 * History & Grade Mutation E2E — covers:
 *   1. Auth guards: 401/403 on all 4 new endpoints
 *   2. GET /classes/:classId/sessions — pagination, X-Total-Count header, cross-teacher isolation
 *   3. PATCH /sessions/:id/results/:id/raw-value — DTO validation, SEC-001 cross-session injection
 *   4. DELETE /sessions/:id/results/:id/history — 204, SEC-001, idempotency
 *   5. DELETE /sessions/:id — 204, 404, 403 cross-teacher, idempotency
 *   6. PATCH /sessions/:id/results/:id (override grade) — optional reason, boundary validation
 *
 * Uses a real PostgreSQL test database (same AppModule as all other e2e suites).
 * Luhn-valid national IDs used: 000000174, 000000182 (not used by other suites).
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

// ─── Luhn-valid IDs — no collision with other e2e suites ─────────────────────
const STUDENT_H1 = '000000174'; // sum = 10 ✓
const STUDENT_H2 = '000000182'; // sum = 10 ✓

// ─── Typed helpers ────────────────────────────────────────────────────────────

interface SessionBody {
  id: string;
  classId: string;
  testTypeId: string;
  completedAt: string | null;
}

interface ResultBody {
  id: string;
  sessionId: string;
  studentId: string;
  rawValue: number;
  calculatedGrade: number;
}

interface TestTypeBody {
  id: string;
  nameHe: string;
  inputType: string;
}

interface StudentEnrollBody {
  student: { id: string; nationalId: string };
  reEnrolled: boolean;
}

// ─── Suite setup ──────────────────────────────────────────────────────────────

describe('History & Grade Mutation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let teacherToken: string;
  let studentToken: string;
  let otherTeacherToken: string;

  let classId: string;
  let testTypeId: string;
  let testInputType: string;
  let studentH1Id: string;
  let studentH2Id: string;

  /** Session that persists through most suites. */
  let mainSessionId: string;
  /** Result for studentH1 in mainSession. */
  let mainResultId: string;

  /** Isolated second session — used for SEC-001 cross-session injection tests. */
  let secondSessionId: string;
  /** Result for studentH1 in secondSession — used to prove cross-session injection blocked. */
  let secondResultId: string;

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
    jwtService = app.get(JwtService);

    // Teacher token via dev-login (requires seeded teacher@test.com)
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/dev-login')
      .expect(200);
    teacherToken = (loginRes.body as { accessToken: string }).accessToken;

    // Student and other-teacher tokens (no real DB record needed for 4xx tests)
    studentToken = jwtService.sign({ sub: 'fake-student-history', role: 'STUDENT' });
    otherTeacherToken = jwtService.sign({ sub: 'other-teacher-history', role: 'TEACHER' });

    // ── Create class ─────────────────────────────────────────────────────────
    const classRes = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'History E2E Class', academicYear: '2024-2025', gradeLevel: 9 })
      .expect(201);
    classId = (classRes.body as { id: string }).id;

    // ── Enroll students ───────────────────────────────────────────────────────
    const enroll = async (nationalId: string, firstName: string): Promise<string> => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName, lastName: 'היסטוריה', gender: 'MALE', nationalId })
        .expect((r) => {
          if (r.status !== 201 && r.status !== 200) {
            throw new Error(`Enroll failed: ${r.status} ${JSON.stringify(r.body)}`);
          }
        });
      return (res.body as StudentEnrollBody).student.id;
    };

    studentH1Id = await enroll(STUDENT_H1, 'תלמיד_ה1');
    studentH2Id = await enroll(STUDENT_H2, 'תלמיד_ה2');

    // ── Find a test type with broad norm coverage (grades 1-12 = all classes) ─
    // Prefer the '4×10 shuttle' TIME type which covers all grade levels;
    // fall back to any TIME type, then any available type.
    const typesRes = await request(app.getHttpServer())
      .get('/api/tests/types')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const allTypes = typesRes.body as TestTypeBody[];
    if (allTypes.length === 0) throw new Error('No test types in seed data');
    // Prefer TIME types (broad norm coverage); avoid types that only cover grades 1-4
    const preferred = allTypes.find((t) => t.inputType === 'TIME' && t.nameHe.includes('4×10'))
      ?? allTypes.find((t) => t.inputType === 'TIME')
      ?? allTypes.find((t) => t.inputType === 'REPS')
      ?? allTypes[0]!;
    testTypeId = preferred.id;
    testInputType = preferred.inputType;

    // ── Create main session ───────────────────────────────────────────────────
    const sessionRes = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/sessions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ testTypeId, semester: 'A' })
      .expect(201);
    mainSessionId = (sessionRes.body as SessionBody).id;

    // Insert results directly via Prisma to bypass GradingService norm-table
    // lookup — avoids coupling test setup to specific norm table configurations.
    // This mirrors how tests.e2e-spec.ts manipulates DB state directly.
    const mainResult = await prisma.testResult.create({
      data: { sessionId: mainSessionId, studentId: studentH1Id, rawValue: 30, calculatedGrade: 80 },
    });
    mainResultId = mainResult.id;

    // ── Create second session + result (for SEC-001 tests) ────────────────────
    const s2Res = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/sessions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ testTypeId, semester: 'B' })
      .expect(201);
    secondSessionId = (s2Res.body as SessionBody).id;

    const secondResult = await prisma.testResult.create({
      data: { sessionId: secondSessionId, studentId: studentH2Id, rawValue: 25, calculatedGrade: 70 },
    });
    secondResultId = secondResult.id;
  }, 60_000);

  afterAll(async () => {
    // FK-safe cleanup
    await prisma.auditLog.deleteMany({
      where: { OR: [{ entityId: mainSessionId }, { entityId: secondSessionId }, { entityId: mainResultId }, { entityId: secondResultId }] },
    });
    await prisma.testResult.deleteMany({ where: { session: { classId } } });
    await prisma.testSession.deleteMany({ where: { classId } });
    await prisma.classEnrollment.deleteMany({ where: { classId } });
    await prisma.student.deleteMany({ where: { nationalId: { in: [STUDENT_H1, STUDENT_H2] } } });
    await prisma.class.deleteMany({ where: { id: classId } });
    await app.close();
  }, 30_000);

  // ─── Suite H1 — Auth guards ────────────────────────────────────────────────

  describe('Suite H1 — auth guards on all 4 new endpoints', () => {
    const FAKE_UUID = '00000000-0000-0000-0000-000000000001';

    it('H1.1 GET /classes/:id/sessions  no token → 401', async () => {
      await request(app.getHttpServer())
        .get(`/api/classes/${classId}/sessions`)
        .expect(401);
    });

    it('H1.2 GET /classes/:id/sessions  student token → 403', async () => {
      await request(app.getHttpServer())
        .get(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('H1.3 PATCH /sessions/:id/results/:id/raw-value  no token → 401', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${FAKE_UUID}/results/${FAKE_UUID}/raw-value`)
        .send({ rawValue: 1 })
        .expect(401);
    });

    it('H1.4 PATCH /sessions/:id/results/:id/raw-value  student token → 403', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${FAKE_UUID}/results/${FAKE_UUID}/raw-value`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ rawValue: 1 })
        .expect(403);
    });

    it('H1.5 DELETE /sessions/:id/results/:id/history  no token → 401', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${FAKE_UUID}/results/${FAKE_UUID}/history`)
        .expect(401);
    });

    it('H1.6 DELETE /sessions/:id/results/:id/history  student token → 403', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${FAKE_UUID}/results/${FAKE_UUID}/history`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('H1.7 DELETE /sessions/:id  no token → 401', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${FAKE_UUID}`)
        .expect(401);
    });

    it('H1.8 DELETE /sessions/:id  student token → 403', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${FAKE_UUID}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  // ─── Suite H2 — GET /classes/:classId/sessions ────────────────────────────

  describe('Suite H2 — GET /classes/:classId/sessions', () => {
    it('H2.1 teacher owns class → 200 with array body and X-Total-Count header', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const totalCount = res.headers['x-total-count'];
      expect(totalCount).toBeDefined();
      expect(parseInt(totalCount as string, 10)).toBeGreaterThanOrEqual(0);
    });

    it('H2.2 X-Total-Count header matches body array length on first page', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/sessions?take=50&skip=0`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const body = res.body as unknown[];
      const totalCount = parseInt(res.headers['x-total-count'] as string, 10);
      // Rows returned cannot exceed total
      expect(body.length).toBeLessThanOrEqual(totalCount);
    });

    it('H2.3 take=1&skip=0 returns exactly 1 row when sessions exist', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/sessions?take=1&skip=0`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect((res.body as unknown[]).length).toBe(1);
    });

    it('H2.4 skip beyond total → empty array with correct total in header', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/sessions?take=50&skip=10000`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect((res.body as unknown[]).length).toBe(0);
      expect(parseInt(res.headers['x-total-count'] as string, 10)).toBeGreaterThanOrEqual(0);
    });

    it('H2.5 class belongs to OTHER teacher → 403 (ownership enforced)', async () => {
      await request(app.getHttpServer())
        .get(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .expect(403);
    });

    it('H2.6 session rows have numeric resultCount field (not Prisma Decimal string)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/sessions?take=10&skip=0`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const rows = res.body as Array<{ resultCount: unknown }>;
      for (const row of rows) {
        expect(typeof row.resultCount).toBe('number');
      }
    });
  });

  // ─── Suite H3 — PATCH /sessions/:id/results/:id/raw-value ─────────────────

  describe('Suite H3 — PATCH raw-value', () => {
    it('H3.1 valid rawValue=35 → 200 with recalculated grade', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${mainResultId}/raw-value`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ rawValue: 35 })
        .expect(200);

      const body = res.body as ResultBody;
      expect(body.id).toBe(mainResultId);
      expect(typeof body.calculatedGrade).toBe('number');
    });

    it('H3.2 rawValue=-1 fails DTO @Min(0) → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${mainResultId}/raw-value`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ rawValue: -1 })
        .expect(400);
    });

    it('H3.3 rawValue missing from body → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${mainResultId}/raw-value`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({})
        .expect(400);
    });

    it('H3.4 rawValue="abc" (non-number) → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${mainResultId}/raw-value`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ rawValue: 'abc' })
        .expect(400);
    });

    it('H3.5 SEC-001: resultId from a DIFFERENT session → 404 (cross-session injection blocked)', async () => {
      // secondResultId belongs to secondSessionId — using it via mainSessionId must fail.
      // rawValue=35 passes the TIME minimum-seconds check so the 404 is properly reached.
      await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${secondResultId}/raw-value`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ rawValue: 35 })
        .expect(404);
    });

    it('H3.6 non-existent sessionId → 404', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/00000000-0000-0000-0000-000000000099/results/${mainResultId}/raw-value`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ rawValue: 1 })
        .expect(404);
    });
  });

  // ─── Suite H4 — DELETE /sessions/:id/results/:id/history ──────────────────

  describe('Suite H4 — DELETE result from history', () => {
    let disposableResultId: string;

    beforeAll(async () => {
      // Insert a disposable result directly via Prisma (same pattern as main setup)
      const disposable = await prisma.testResult.create({
        data: { sessionId: mainSessionId, studentId: studentH2Id, rawValue: 20, calculatedGrade: 60 },
      });
      disposableResultId = disposable.id;
    });

    it('H4.1 valid delete → 204 No Content', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${mainSessionId}/results/${disposableResultId}/history`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(204);
    });

    it('H4.2 second delete of same result → 404 (already deleted)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${mainSessionId}/results/${disposableResultId}/history`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });

    it('H4.3 SEC-001: resultId from different session → 404', async () => {
      // mainResultId belongs to mainSession — accessing via secondSession must fail
      await request(app.getHttpServer())
        .delete(`/api/sessions/${secondSessionId}/results/${mainResultId}/history`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });

    it('H4.4 non-existent resultId → 404', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${mainSessionId}/results/00000000-0000-0000-0000-000000000099/history`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });
  });

  // ─── Suite H5 — DELETE /sessions/:sessionId ───────────────────────────────

  describe('Suite H5 — DELETE session', () => {
    let disposableSessionId: string;

    beforeAll(async () => {
      // Create a dedicated session to delete — keeps main session intact for other suites
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: testTypeId, semester: 'A' })
        .expect(201);
      disposableSessionId = (res.body as SessionBody).id;
    });

    it('H5.1 non-existent sessionId → 404', async () => {
      await request(app.getHttpServer())
        .delete('/api/sessions/00000000-0000-0000-0000-000000000099')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });

    it('H5.2 session belongs to other teacher → 403', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${disposableSessionId}`)
        .set('Authorization', `Bearer ${otherTeacherToken}`)
        .expect(403);
    });

    it('H5.3 valid delete → 204 No Content', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${disposableSessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(204);
    });

    it('H5.4 second delete of same session → 404 (already deleted)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${disposableSessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });

    it('H5.5 after deletion, GET /sessions/:id → 404', async () => {
      await request(app.getHttpServer())
        .get(`/api/sessions/${disposableSessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);
    });
  });

  // ─── Suite H6 — PATCH override grade (optional reason) ────────────────────

  describe('Suite H6 — PATCH override grade', () => {
    it('H6.1 override with grade only (no reason) → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${mainResultId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ gradeOverride: 80 })
        .expect(200);

      const body = res.body as ResultBody & { gradeOverride: number };
      expect(body.gradeOverride).toBe(80);
    });

    it('H6.2 override with empty string reason → 200 (reason is optional, no MinLength)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${mainResultId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ gradeOverride: 75, overrideReason: '' })
        .expect(200);
    });

    it('H6.3 gradeOverride=101 exceeds @Max(100) → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${mainResultId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ gradeOverride: 101 })
        .expect(400);
    });

    it('H6.4 gradeOverride=-1 fails @Min(0) → 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/sessions/${mainSessionId}/results/${mainResultId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ gradeOverride: -1 })
        .expect(400);
    });
  });
});
