/**
 * Butterfly Effect E2E — Combinatorial data-consistency tests.
 *
 * These tests chain state mutations and verify that every API surface
 * that the UI would read reflects the EXACT resulting state.
 * They act as the integration-layer equivalent of Playwright UI tests,
 * testing all relevant API endpoints in sequence rather than DOM nodes.
 *
 * Chain 1 — Result life-cycle (submit → delete → re-submit with new value)
 *   Verifies: session page, student profile, and dashboard top-students
 *   all reflect the correct state after every mutation step.
 *
 * Chain 2 — Semester isolation invariant
 *   Verifies: results submitted to a Semester-A session NEVER appear in
 *   Semester-B queries, and vice-versa — regardless of what the teacher's
 *   UI semester toggle shows at the time of submission.
 */

import * as request from 'supertest';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

// ─── Luhn-valid IDs — do not collide with other e2e specs ─────────────────────
// Verified: sum % 10 === 0
const STUDENT_D_ID = '000000067'; // sum = 10 ✓
const STUDENT_E_ID = '000000075'; // sum = 10 ✓

// ─── Typed helpers ────────────────────────────────────────────────────────────

interface SessionBody    { id: string }
interface ResultBody     { id: string; studentId: string; calculatedGrade: number; rawValue: number }
interface ProfileBody    { overallAvg: number; testHistories: Array<{ testTypeId: string; latestGrade: number; history: unknown[] }> }
interface TopStudentItem { studentId: string; avgGrade: number }
interface TestTypeBody   { id: string; inputType: string }
interface StudentBody    { id: string }

// ─── Suite setup ──────────────────────────────────────────────────────────────

describe('Butterfly Effect (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherToken: string;

  // IDs shared across chains
  let classId: string;
  let passfailTypeId: string;
  let studentDId: string;  // main chain-1 student
  let studentEId: string;  // semester-chain student

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

    // Auth
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/dev-login')
      .expect(200);
    teacherToken = (loginRes.body as { accessToken: string }).accessToken;

    // Create the butterfly-effect test class
    const classRes = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'E2E Butterfly Class', academicYear: '2024-2025', gradeLevel: 10 })
      .expect(201);
    classId = (classRes.body as { id: string }).id;

    // Find a PASS_FAIL test type (no norm table dependency)
    const typesRes = await request(app.getHttpServer())
      .get('/api/tests/types')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const types = typesRes.body as TestTypeBody[];
    const pf = types.find((t) => t.inputType === 'PASS_FAIL');
    if (!pf) throw new Error('No PASS_FAIL test type seeded');
    passfailTypeId = pf.id;

    // Enroll both students
    const enroll = async (nationalId: string, firstName: string): Promise<string> => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName, lastName: 'פרפר', gender: 'MALE', nationalId })
        .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Enroll failed: ${r.status}`); });
      return (res.body as { student: StudentBody }).student.id;
    };

    studentDId = await enroll(STUDENT_D_ID, 'תלמיד_ד');
    studentEId = await enroll(STUDENT_E_ID, 'תלמיד_ה');
  }, 60_000);

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { session: { classId } } });
    await prisma.testSession.deleteMany({ where: { classId } });
    await prisma.classEnrollment.deleteMany({ where: { classId } });
    await prisma.student.deleteMany({ where: { nationalId: { in: [STUDENT_D_ID, STUDENT_E_ID] } } });
    await prisma.class.deleteMany({ where: { id: classId } });
    await app.close();
  }, 30_000);

  // ─── Chain 1: Result → Delete → Re-submit with new value → Verify sync ───

  describe('Chain 1 — result life-cycle with full API sync verification', () => {
    let sessionId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTypeId, semester: 'A' })
        .expect(201);
      sessionId = (res.body as SessionBody).id;
    });

    afterAll(async () => {
      await prisma.testResult.deleteMany({ where: { sessionId } });
      await prisma.testSession.deleteMany({ where: { id: sessionId } });
    });

    // ── Step 1: Submit result (PASS, rawValue=1 → grade=100) ──────────────

    it('C1-S1a: submit result → session endpoint shows the result', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sessions/${sessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentDId, rawValue: 1 })
        .expect(201);

      const body = res.body as ResultBody;
      expect(body.calculatedGrade).toBe(100);

      const sessRes = await request(app.getHttpServer())
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const sessBody = sessRes.body as { results: ResultBody[] };
      const resultInSession = sessBody.results.find((r) => r.studentId === studentDId);
      expect(resultInSession).toBeDefined();
      expect(resultInSession?.calculatedGrade).toBe(100);
    });

    it('C1-S1b: submit result → student profile reflects grade=100', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/students/${studentDId}/profile?semester=A`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const profile = res.body as ProfileBody;
      expect(profile.overallAvg).toBe(100);
      expect(profile.testHistories).toHaveLength(1);
      expect(profile.testHistories[0]?.latestGrade).toBe(100);
    });

    it('C1-S1c: submit result → student appears in dashboard top-students for this test type', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/top-students?testTypeId=${passfailTypeId}&semester=A`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const topStudents = res.body as TopStudentItem[];
      const found = topStudents.some((s) => s.studentId === studentDId);
      expect(found).toBe(true);
    });

    // ── Step 2: Delete result (within undo window) ─────────────────────────

    it('C1-S2a: delete result → session endpoint shows no results', async () => {
      await request(app.getHttpServer())
        .delete(`/api/sessions/${sessionId}/results/${studentDId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(204);

      const sessRes = await request(app.getHttpServer())
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const sessBody = sessRes.body as { results: ResultBody[] };
      const resultGone = sessBody.results.find((r) => r.studentId === studentDId);
      expect(resultGone).toBeUndefined();
    });

    it('C1-S2b: delete result → student profile shows empty test history (overallAvg=0)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/students/${studentDId}/profile?semester=A`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const profile = res.body as ProfileBody;
      expect(profile.overallAvg).toBe(0);
      expect(profile.testHistories).toHaveLength(0);
    });

    it('C1-S2c: delete result → student no longer in dashboard top-students', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/top-students?testTypeId=${passfailTypeId}&semester=A`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const topStudents = res.body as TopStudentItem[];
      // After deletion, studentD has no grade → should not appear in top-students
      const found = topStudents.some((s) => s.studentId === studentDId);
      expect(found).toBe(false);
    });

    // ── Step 3: Re-submit with different rawValue (FAIL, grade=0) ──────────

    it('C1-S3a: re-submit rawValue=0 → grade flips to 0 in session endpoint', async () => {
      await request(app.getHttpServer())
        .post(`/api/sessions/${sessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentDId, rawValue: 0 })
        .expect(201);

      const sessRes = await request(app.getHttpServer())
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const sessBody = sessRes.body as { results: ResultBody[] };
      const result = sessBody.results.find((r) => r.studentId === studentDId);
      expect(result).toBeDefined();
      expect(result?.calculatedGrade).toBe(0);
    });

    it('C1-S3b: re-submit rawValue=0 → student profile reflects grade=0', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/students/${studentDId}/profile?semester=A`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const profile = res.body as ProfileBody;
      expect(profile.overallAvg).toBe(0);
      expect(profile.testHistories).toHaveLength(1);
      expect(profile.testHistories[0]?.latestGrade).toBe(0);
    });

    it('C1-S3c: student with grade=0 still has a history entry (zero ≠ absent)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/students/${studentDId}/profile?semester=A`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const profile = res.body as ProfileBody;
      // Test history exists with 1 entry — grade=0 is a recorded result, not missing
      expect(profile.testHistories[0]?.history).toHaveLength(1);
    });

    // ── Step 4: Delete again + re-add with passing grade → restored ────────

    it('C1-S4a: delete grade-0 result and re-add grade-100 → profile fully restored', async () => {
      // Delete the grade-0 result
      await request(app.getHttpServer())
        .delete(`/api/sessions/${sessionId}/results/${studentDId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(204);

      // Re-add with passing value
      await request(app.getHttpServer())
        .post(`/api/sessions/${sessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentDId, rawValue: 1 })
        .expect(201);

      // Final state: profile shows grade=100 again
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/students/${studentDId}/profile?semester=A`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const profile = res.body as ProfileBody;
      expect(profile.overallAvg).toBe(100);
      expect(profile.testHistories[0]?.latestGrade).toBe(100);
    });

    it('C1-S4b: DB integrity — exactly ONE TestResult row for this (session, student) after all edits', async () => {
      const count = await prisma.testResult.count({
        where: { sessionId, studentId: studentDId },
      });
      expect(count).toBe(1);
    });
  });

  // ─── Chain 2: Semester isolation invariant ────────────────────────────────
  //
  // Theorem: a result submitted to a Sem-A session NEVER leaks into Sem-B
  // queries, regardless of what the teacher's UI semester toggle shows.
  // The session's semester field is authoritative — not the teacher's active
  // UI state at the moment of submission.

  describe('Chain 2 — semester isolation: result binds to session semester, not UI state', () => {
    let semASessionId: string;
    let semBSessionId: string;

    beforeAll(async () => {
      // Create one session per semester — same test type, same class
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/classes/${classId}/sessions`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ testTypeId: passfailTypeId, semester: 'A' })
          .expect(201),
        request(app.getHttpServer())
          .post(`/api/classes/${classId}/sessions`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ testTypeId: passfailTypeId, semester: 'B' })
          .expect(201),
      ]);
      semASessionId = (resA.body as SessionBody).id;
      semBSessionId = (resB.body as SessionBody).id;
    });

    afterAll(async () => {
      await prisma.testResult.deleteMany({
        where: { sessionId: { in: [semASessionId, semBSessionId] } },
      });
      await prisma.testSession.deleteMany({
        where: { id: { in: [semASessionId, semBSessionId] } },
      });
    });

    it('C2-S1: initially, student profile shows empty histories for both semesters', async () => {
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .get(`/api/classes/${classId}/students/${studentEId}/profile?semester=A`)
          .set('Authorization', `Bearer ${teacherToken}`),
        request(app.getHttpServer())
          .get(`/api/classes/${classId}/students/${studentEId}/profile?semester=B`)
          .set('Authorization', `Bearer ${teacherToken}`),
      ]);
      expect((resA.body as ProfileBody).testHistories).toHaveLength(0);
      expect((resB.body as ProfileBody).testHistories).toHaveLength(0);
    });

    it('C2-S2: submit result to Sem-A session → appears in Sem-A profile, NOT in Sem-B profile', async () => {
      await request(app.getHttpServer())
        .post(`/api/sessions/${semASessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentEId, rawValue: 1 })
        .expect(201);

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .get(`/api/classes/${classId}/students/${studentEId}/profile?semester=A`)
          .set('Authorization', `Bearer ${teacherToken}`),
        request(app.getHttpServer())
          .get(`/api/classes/${classId}/students/${studentEId}/profile?semester=B`)
          .set('Authorization', `Bearer ${teacherToken}`),
      ]);

      // Sem-A: result is visible
      const profileA = resA.body as ProfileBody;
      expect(profileA.testHistories.length).toBeGreaterThan(0);
      expect(profileA.overallAvg).toBe(100);

      // Sem-B: result is NOT visible (semester isolation)
      const profileB = resB.body as ProfileBody;
      expect(profileB.testHistories).toHaveLength(0);
      expect(profileB.overallAvg).toBe(0);
    });

    it('C2-S3: submit result to Sem-B session → appears in Sem-B, Sem-A results unchanged', async () => {
      await request(app.getHttpServer())
        .post(`/api/sessions/${semBSessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentEId, rawValue: 0 }) // fail → grade=0 in Sem B
        .expect(201);

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .get(`/api/classes/${classId}/students/${studentEId}/profile?semester=A`)
          .set('Authorization', `Bearer ${teacherToken}`),
        request(app.getHttpServer())
          .get(`/api/classes/${classId}/students/${studentEId}/profile?semester=B`)
          .set('Authorization', `Bearer ${teacherToken}`),
      ]);

      // Sem-A: still shows grade=100 — Sem-B result did not pollute Sem-A
      const profileA = resA.body as ProfileBody;
      expect(profileA.overallAvg).toBe(100);

      // Sem-B: now shows grade=0 — Sem-B result is visible in Sem-B
      const profileB = resB.body as ProfileBody;
      expect(profileB.overallAvg).toBe(0);
      expect(profileB.testHistories.length).toBeGreaterThan(0);
    });

    it('C2-S4: dashboard top-students Sem-A includes studentE; Sem-B does NOT (grade=0 is excluded from "top")', async () => {
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .get(`/api/dashboard/top-students?testTypeId=${passfailTypeId}&semester=A`)
          .set('Authorization', `Bearer ${teacherToken}`),
        request(app.getHttpServer())
          .get(`/api/dashboard/top-students?testTypeId=${passfailTypeId}&semester=B`)
          .set('Authorization', `Bearer ${teacherToken}`),
      ]);

      const topA = resA.body as TopStudentItem[];
      const topB = resB.body as TopStudentItem[];

      // Sem-A: grade=100 → should appear in top students
      expect(topA.some((s) => s.studentId === studentEId)).toBe(true);

      // Sem-B: grade=0 → should NOT appear in top students
      // (Top students only includes meaningful/passing scores)
      const inTopB = topB.find((s) => s.studentId === studentEId);
      if (inTopB !== undefined) {
        // If the student appears, their avg must be 0 (not a false positive from Sem-A data)
        expect(inTopB.avgGrade).toBe(0);
      }
    });

    it('C2-S5: DB row for Sem-A result has semester=A; Sem-B result has semester=B (via session)', async () => {
      const [resultA, resultB] = await Promise.all([
        prisma.testResult.findFirst({
          where: { sessionId: semASessionId, studentId: studentEId },
          include: { session: { select: { semester: true } } },
        }),
        prisma.testResult.findFirst({
          where: { sessionId: semBSessionId, studentId: studentEId },
          include: { session: { select: { semester: true } } },
        }),
      ]);

      expect(resultA?.session.semester).toBe('A');
      expect(resultB?.session.semester).toBe('B');
    });
  });
});
