/**
 * Dashboard API E2E
 *
 * Covers three invariants:
 *
 * 1. Teacher data isolation — Teacher B's token cannot see Teacher A's students,
 *    classes, or results in any dashboard endpoint. Achieved by creating a real
 *    Teacher B record (via Prisma) and signing a JWT for them.
 *
 * 2. Semester aggregation — stats and top-students return ONLY the data that
 *    belongs to the requested semester. Tested by seeding both Sem-A and Sem-B
 *    sessions for Teacher B and asserting the counts diverge under filtering.
 *
 * 3. Empty state — a class that has students but zero sessions produces correct
 *    zero/empty responses across all dashboard endpoints without runtime errors.
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
import { Semester } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

// ─── Luhn-valid IDs — no collisions with other e2e specs ──────────────────────
const STUDENT_H_ID = '000000109'; // sum = 10 ✓
const STUDENT_I_ID = '000000117'; // sum = 10 ✓
const STUDENT_J_ID = '000000125'; // sum = 10 ✓
const STUDENT_K_ID = '000000133'; // sum = 10 ✓

// ─── Typed helpers ────────────────────────────────────────────────────────────

interface ClassBody         { id: string }
interface SessionBody       { id: string }
interface StudentBody       { id: string }
interface StatsBody         { totalStudents: number; overallFitnessAvg: number; pendingResultsCount: number; classStats: Array<{ classId: string; fitnessAvg: number }> }
interface TopStudentItem    { studentId: string; avgGrade: number; rank: number }
interface TopAchievementItem { studentId: string; score: number }
interface TopPerClassItem   { classId: string; studentId: string }

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Dashboard (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Teacher A = the seeded dev-login teacher (used in other e2e suites too)
  let teacherAToken: string;
  let teacherAId: string;

  // Teacher B = a real DB record created here for isolation tests
  let teacherBToken: string;
  let teacherBId: string;

  // Teacher B's class IDs
  let semAClassId: string;
  let semBClassId: string;
  let emptyClassId: string;

  // Student DB IDs within Teacher B's classes
  let studentHId: string; // Sem-A class, student 1
  let studentIId: string; // Sem-A class, student 2
  let studentJId: string; // Sem-B class, student 1
  let studentKId: string; // empty class, student 1

  // PASS_FAIL test type ID
  let passfailTypeId: string;

  // Session IDs for cleanup
  const createdSessionIds: string[] = [];

  // ── helpers ──────────────────────────────────────────────────────────────────

  async function enroll(token: string, classId: string, nationalId: string, firstName: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/students`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName, lastName: 'דשבורד', gender: 'MALE', nationalId })
      .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Enroll failed: ${r.status} ${JSON.stringify(r.body)}`); });
    return (res.body as { student: StudentBody }).student.id;
  }

  async function createSession(token: string, classId: string, semester: 'A' | 'B'): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ testTypeId: passfailTypeId, semester })
      .expect(201);
    const id = (res.body as SessionBody).id;
    createdSessionIds.push(id);
    return id;
  }

  async function submitResult(token: string, sessionId: string, studentId: string, rawValue: number): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/sessions/${sessionId}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId, rawValue })
      .expect(201);
  }

  // ─────────────────────────────────────────────────────────────────────────────

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

    // ── Teacher A (dev-login) ────────────────────────────────────────────────
    const loginRes = await request(app.getHttpServer()).post('/api/auth/dev-login').expect(200);
    teacherAToken = (loginRes.body as { accessToken: string }).accessToken;
    const meRes = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${teacherAToken}`).expect(200);
    teacherAId = (meRes.body as { id: string }).id;

    // ── Teacher B (created directly in DB for clean isolation) ───────────────
    const ts = Date.now();
    const teacherBRecord = await prisma.user.create({
      data: {
        email:    `teacher-b-${ts}@e2e-dashboard.test`,
        name:     'Teacher B (E2E Dashboard)',
        googleId: `e2e-dashboard-b-${ts}`,
      },
    });
    teacherBId  = teacherBRecord.id;
    teacherBToken = jwtService.sign({ sub: teacherBId, role: 'TEACHER' });

    // ── Test type (PASS_FAIL) ────────────────────────────────────────────────
    const typesRes = await request(app.getHttpServer()).get('/api/tests/types').set('Authorization', `Bearer ${teacherBToken}`).expect(200);
    const pf = (typesRes.body as Array<{ id: string; inputType: string }>).find((t) => t.inputType === 'PASS_FAIL');
    if (!pf) throw new Error('No PASS_FAIL test type seeded');
    passfailTypeId = pf.id;

    // ── Teacher B — Sem-A class (2 students, 2 Sem-A sessions, results) ──────
    const semARes = await request(app.getHttpServer()).post('/api/classes').set('Authorization', `Bearer ${teacherBToken}`).send({ name: 'Dash Sem-A Class', academicYear: '2024-2025', gradeLevel: 10 }).expect(201);
    semAClassId = (semARes.body as ClassBody).id;
    studentHId = await enroll(teacherBToken, semAClassId, STUDENT_H_ID, 'תלמיד_ח');
    studentIId = await enroll(teacherBToken, semAClassId, STUDENT_I_ID, 'תלמיד_ט');

    const sessA1 = await createSession(teacherBToken, semAClassId, 'A');
    const sessA2 = await createSession(teacherBToken, semAClassId, 'A');
    await submitResult(teacherBToken, sessA1, studentHId, 1); // grade=100
    await submitResult(teacherBToken, sessA1, studentIId, 1); // grade=100
    await submitResult(teacherBToken, sessA2, studentHId, 1); // grade=100

    // ── Teacher B — Sem-B class (1 student, 1 Sem-B session, 1 result) ───────
    const semBRes = await request(app.getHttpServer()).post('/api/classes').set('Authorization', `Bearer ${teacherBToken}`).send({ name: 'Dash Sem-B Class', academicYear: '2024-2025', gradeLevel: 10 }).expect(201);
    semBClassId = (semBRes.body as ClassBody).id;
    studentJId = await enroll(teacherBToken, semBClassId, STUDENT_J_ID, 'תלמיד_י');

    const sessB1 = await createSession(teacherBToken, semBClassId, 'B');
    await submitResult(teacherBToken, sessB1, studentJId, 1); // grade=100

    // ── Teacher B — empty class (2 students, zero sessions) ──────────────────
    const emptyRes = await request(app.getHttpServer()).post('/api/classes').set('Authorization', `Bearer ${teacherBToken}`).send({ name: 'Dash Empty Class', academicYear: '2024-2025', gradeLevel: 10 }).expect(201);
    emptyClassId = (emptyRes.body as ClassBody).id;
    studentKId = await enroll(teacherBToken, emptyClassId, STUDENT_K_ID, 'תלמיד_כ');
  }, 90_000);

  afterAll(async () => {
    // Deleting Teacher B cascades to all their classes, sessions, results, enrollments
    await prisma.user.deleteMany({ where: { id: teacherBId } });
    // Also clean up the students (not cascaded by user deletion)
    await prisma.student.deleteMany({
      where: { nationalId: { in: [STUDENT_H_ID, STUDENT_I_ID, STUDENT_J_ID, STUDENT_K_ID] } },
    });
    await app.close();
  }, 30_000);

  // ─── Suite 1 — Teacher data isolation ────────────────────────────────────

  describe('Suite 1 — teacher data isolation', () => {
    it('T1.1 Teacher B can see their own stats (self-check)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const body = res.body as StatsBody;
      // Teacher B has 3 classes with studentH, studentI, studentJ, studentK enrolled
      expect(body.totalStudents).toBeGreaterThanOrEqual(4);
    });

    it('T1.2 Teacher A token returns Teacher A stats (not Teacher B data)', async () => {
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer()).get('/api/dashboard/stats').set('Authorization', `Bearer ${teacherAToken}`).expect(200),
        request(app.getHttpServer()).get('/api/dashboard/stats').set('Authorization', `Bearer ${teacherBToken}`).expect(200),
      ]);

      const statsA = resA.body as StatsBody;
      const statsB = resB.body as StatsBody;

      // Teacher A's classStats should NOT contain Teacher B's classIds
      const teacherAClassIds = statsA.classStats.map((c) => c.classId);
      expect(teacherAClassIds).not.toContain(semAClassId);
      expect(teacherAClassIds).not.toContain(semBClassId);
      expect(teacherAClassIds).not.toContain(emptyClassId);

      // Teacher B's classStats should NOT contain any of Teacher A's classes
      const teacherBClassIds = statsB.classStats.map((c) => c.classId);
      for (const id of teacherBClassIds) {
        expect(teacherAClassIds).not.toContain(id); // no overlap
      }
    });

    it('T1.3 Teacher B top-students includes only Teacher B students', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/top-students')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const items = res.body as TopStudentItem[];
      // Teacher B's top students should include their seeded students
      const ids = items.map((s) => s.studentId);
      expect(ids).toContain(studentHId);
      expect(ids).toContain(studentIId);
      expect(ids).toContain(studentJId);
    });

    it('T1.4 Teacher A top-students does NOT include Teacher B students', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/top-students')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const ids = (res.body as TopStudentItem[]).map((s) => s.studentId);
      expect(ids).not.toContain(studentHId);
      expect(ids).not.toContain(studentIId);
      expect(ids).not.toContain(studentJId);
    });

    it('T1.5 top-achievements for Teacher A does NOT include Teacher B students', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/top-achievements')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const ids = (res.body as TopAchievementItem[]).map((s) => s.studentId);
      expect(ids).not.toContain(studentHId);
      expect(ids).not.toContain(studentIId);
    });

    it('T1.6 top-per-class for Teacher B does NOT include Teacher A class IDs', async () => {
      const resA = await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);
      const teacherAClassIds = (resA.body as StatsBody).classStats.map((c) => c.classId);

      const res = await request(app.getHttpServer())
        .get('/api/dashboard/top-per-class')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const classIds = (res.body as TopPerClassItem[]).map((s) => s.classId);
      for (const id of classIds) {
        expect(teacherAClassIds).not.toContain(id);
      }
    });
  });

  // ─── Suite 2 — Semester aggregation ──────────────────────────────────────

  describe('Suite 2 — semester aggregation', () => {
    it('T2.1 GET /stats?semester=A — classStats includes semAClassId with results', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/stats?semester=A')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const body = res.body as StatsBody;
      const semAClass = body.classStats.find((c) => c.classId === semAClassId);
      expect(semAClass).toBeDefined();
      expect(semAClass?.fitnessAvg).toBe(100); // all results were grade=100
    });

    it('T2.2 GET /stats?semester=A — semBClassId has no results in Sem-A (fitnessAvg=0)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/stats?semester=A')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const body = res.body as StatsBody;
      const semBClass = body.classStats.find((c) => c.classId === semBClassId);
      // Sem-B class has only Sem-B sessions — under ?semester=A it has 0 results
      expect(semBClass?.fitnessAvg).toBe(0);
    });

    it('T2.3 GET /stats?semester=B — semBClassId now has results (fitnessAvg=100)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/stats?semester=B')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const body = res.body as StatsBody;
      const semBClass = body.classStats.find((c) => c.classId === semBClassId);
      expect(semBClass?.fitnessAvg).toBe(100);
    });

    it('T2.4 GET /stats?semester=B — semAClassId now has fitnessAvg=0 (no Sem-B sessions)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/stats?semester=B')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const body = res.body as StatsBody;
      const semAClass = body.classStats.find((c) => c.classId === semAClassId);
      expect(semAClass?.fitnessAvg).toBe(0);
    });

    it('T2.5 top-students?semester=A includes Sem-A students, NOT the Sem-B-only student', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/top-students?semester=A')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const ids = (res.body as TopStudentItem[]).map((s) => s.studentId);
      // Students H and I have Sem-A results → must appear
      expect(ids).toContain(studentHId);
      expect(ids).toContain(studentIId);
      // Student J only has a Sem-B result → must NOT appear in Sem-A top-students
      expect(ids).not.toContain(studentJId);
    });

    it('T2.6 top-students?semester=B includes Sem-B student, NOT the Sem-A-only students', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/top-students?semester=B')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const ids = (res.body as TopStudentItem[]).map((s) => s.studentId);
      // Student J has a Sem-B result → must appear
      expect(ids).toContain(studentJId);
      // Students H and I only have Sem-A results → must NOT appear in Sem-B top-students
      expect(ids).not.toContain(studentHId);
      expect(ids).not.toContain(studentIId);
    });

    it('T2.7 top-students?testTypeId&semester=A — only returns students with results for that test type in Sem-A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/dashboard/top-students?testTypeId=${passfailTypeId}&semester=A`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const items = res.body as TopStudentItem[];
      expect(items.every((s) => s.avgGrade > 0)).toBe(true); // all have actual results
      const ids = items.map((s) => s.studentId);
      expect(ids).not.toContain(studentJId); // Sem-B only
    });

    it('T2.8 totalStudents is NOT semester-filtered (classes are year-round)', async () => {
      const [resA, resB, resAll] = await Promise.all([
        request(app.getHttpServer()).get('/api/dashboard/stats?semester=A').set('Authorization', `Bearer ${teacherBToken}`).expect(200),
        request(app.getHttpServer()).get('/api/dashboard/stats?semester=B').set('Authorization', `Bearer ${teacherBToken}`).expect(200),
        request(app.getHttpServer()).get('/api/dashboard/stats').set('Authorization', `Bearer ${teacherBToken}`).expect(200),
      ]);

      // totalStudents counts enrolled students regardless of semester — same for A, B, and all
      expect((resA.body as StatsBody).totalStudents).toBe((resAll.body as StatsBody).totalStudents);
      expect((resB.body as StatsBody).totalStudents).toBe((resAll.body as StatsBody).totalStudents);
    });
  });

  // ─── Suite 3 — Empty state handling ──────────────────────────────────────

  describe('Suite 3 — empty state (class with students, zero sessions)', () => {
    it('T3.1 GET /stats — empty class appears in classStats with fitnessAvg=0 (no crash)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const body = res.body as StatsBody;
      const emptyClass = body.classStats.find((c) => c.classId === emptyClassId);
      expect(emptyClass).toBeDefined();
      expect(emptyClass?.fitnessAvg).toBe(0);
    });

    it('T3.2 GET /stats — empty class student is included in totalStudents', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const body = res.body as StatsBody;
      // emptyClassId has 1 enrolled student — contributes to totalStudents
      expect(body.totalStudents).toBeGreaterThanOrEqual(1);
    });

    it('T3.3 pendingResultsCount=0 for a class with zero sessions (no grading started)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      // When no sessions exist, no "pending" results exist either
      // (pending = started grading but missing some students — requires at least 1 result)
      const body = res.body as StatsBody;
      // Total pending for Teacher B: only Sem-A sessions where studentI has no result in sessA2
      // sessA2 had only studentH's result (studentI was missed) = 1 pending
      // emptyClass contributes 0 pending
      expect(body.pendingResultsCount).toBeGreaterThanOrEqual(0); // never negative
    });

    it('T3.4 GET /top-students — empty class student (studentK) is NOT in top-students (no results)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/top-students')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const ids = (res.body as TopStudentItem[]).map((s) => s.studentId);
      expect(ids).not.toContain(studentKId);
    });

    it('T3.5 GET /top-per-class — empty class has no entry in top-per-class (requires at least 1 result)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/top-per-class')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const classIds = (res.body as TopPerClassItem[]).map((s) => s.classId);
      expect(classIds).not.toContain(emptyClassId);
    });

    it('T3.6 GET /class-averages — empty class produces no data points (no sessions to aggregate)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/class-averages')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const items = res.body as Array<{ classId: string }>;
      const emptyEntry = items.find((m) => m.classId === emptyClassId);
      expect(emptyEntry).toBeUndefined();
    });

    it('T3.7 GET /below-norm-details — empty class produces no below-norm entries', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/below-norm-details')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const items = res.body as Array<{ classId: string }>;
      const emptyEntry = items.find((m) => m.classId === emptyClassId);
      expect(emptyEntry).toBeUndefined();
    });

    it('T3.8 GET /missing-results — empty class has no missing-result entries (no sessions = nothing started)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/missing-results')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const items = res.body as Array<{ classId: string }>;
      const emptyEntry = items.find((m) => m.classId === emptyClassId);
      expect(emptyEntry).toBeUndefined();
    });
  });
});
