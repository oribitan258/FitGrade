/**
 * Cascade Delete — DB Referential Integrity Tests.
 *
 * Verifies that the Prisma schema cascade rules are correctly applied
 * when records are deleted, and that no orphaned foreign-key rows remain.
 *
 * Since the API does not expose DELETE endpoints for classes or students,
 * deletions are performed directly via Prisma (the same ORM used in production).
 * API calls verify that subsequent queries reflect the correct post-deletion state.
 *
 * Schema cascade rules confirmed from schema.prisma:
 *   Class  → { ClassEnrollment, TestSession, AttendanceRecord,
 *              TalmidautRecord, StudentFinalGrade, ScheduleEntry } : Cascade
 *   TestSession → TestResult                                        : Cascade
 *   TestSession → AttendanceRecord.sessionId                       : SetNull
 *   Student → { ClassEnrollment, TestResult, AttendanceRecord,
 *               TalmidautRecord, StudentFinalGrade }                : Cascade
 *   AuditLog → User (actor only)                                    : Cascade
 *   (AuditLog is NOT cascaded by Class or Student deletions)
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
import { Semester } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

// ─── Luhn-valid IDs — no collisions with other e2e specs ──────────────────────
const STUDENT_F_ID = '000000083'; // sum = 10 ✓
const STUDENT_G_ID = '000000091'; // sum = 10 ✓

// ─── Typed helpers ────────────────────────────────────────────────────────────

interface TestTypeBody { id: string; inputType: string }
interface StudentBody  { id: string }

// ─── Global test infrastructure ───────────────────────────────────────────────

describe('Cascade Delete — DB Integrity (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherToken: string;
  let teacherId: string;      // DB id of the dev-login teacher
  let passfailTypeId: string;

  let studentFId: string;
  let studentGId: string;

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

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/dev-login')
      .expect(200);
    teacherToken = (loginRes.body as { accessToken: string }).accessToken;

    // Resolve teacher DB id from /auth/me
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    teacherId = (meRes.body as { id: string }).id;

    // Find PASS_FAIL test type (no norm dependency)
    const typesRes = await request(app.getHttpServer())
      .get('/api/tests/types')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const pf = (typesRes.body as TestTypeBody[]).find((t) => t.inputType === 'PASS_FAIL');
    if (!pf) throw new Error('No PASS_FAIL test type seeded');
    passfailTypeId = pf.id;

    // Create the two test students (reused across suites that need them)
    const enroll = async (classId: string, nationalId: string, first: string): Promise<string> => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: first, lastName: 'מחיקה', gender: 'MALE', nationalId })
        .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Enroll failed ${r.status}`); });
      return (res.body as { student: StudentBody }).student.id;
    };

    // Create a bootstrap class just to enroll the students and get their DB ids
    const bootstrapRes = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Bootstrap Class', academicYear: '2024-2025', gradeLevel: 10 })
      .expect(201);
    const bootstrapClassId = (bootstrapRes.body as { id: string }).id;

    studentFId = await enroll(bootstrapClassId, STUDENT_F_ID, 'תלמיד_ו');
    studentGId = await enroll(bootstrapClassId, STUDENT_G_ID, 'תלמיד_ז');

    // Clean up bootstrap class (students persist via Student table)
    await prisma.classEnrollment.deleteMany({ where: { classId: bootstrapClassId } });
    await prisma.class.deleteMany({ where: { id: bootstrapClassId } });
  }, 60_000);

  afterAll(async () => {
    // Best-effort cleanup of any students that survived
    await prisma.student.deleteMany({
      where: { nationalId: { in: [STUDENT_F_ID, STUDENT_G_ID] } },
    });
    await app.close();
  }, 30_000);

  // ─── Suite 1: Remove single student from class (delete ClassEnrollment) ──

  describe('Suite 1 — remove student from class (delete ClassEnrollment)', () => {
    let classId: string;

    beforeAll(async () => {
      // Create class and re-enroll student F
      const res = await request(app.getHttpServer())
        .post('/api/classes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Cascade Class 1', academicYear: '2024-2025', gradeLevel: 10 })
        .expect(201);
      classId = (res.body as { id: string }).id;

      // Re-enroll studentF in this class (re-enrollment returns 200)
      await request(app.getHttpServer())
        .post(`/api/classes/${classId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: 'תלמיד_ו', lastName: 'מחיקה', gender: 'MALE', nationalId: STUDENT_F_ID })
        .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Re-enroll failed ${r.status}`); });

      // Seed a session + result
      const sessRes = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTypeId, semester: 'A' })
        .expect(201);
      const sessionId = (sessRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/api/sessions/${sessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentFId, rawValue: 1 })
        .expect(201);

      // Seed attendance, talmidaut, and final grade directly via Prisma
      // (no remove-student API exists — these are seeded to verify cascade/retention behavior)
      await prisma.attendanceRecord.create({
        data: {
          classId,
          studentId: studentFId,
          date: new Date('2025-01-15'),
          status: 'PRESENT',
          semester: Semester.A,
        },
      });
      await prisma.talmidautRecord.create({
        data: {
          classId,
          studentId: studentFId,
          participation: 80,
          uniform: 80,
          behavior: 80,
          lessonDate: new Date('2025-01-15'),
        },
      });
      await prisma.studentFinalGrade.upsert({
        where: { classId_studentId: { classId, studentId: studentFId } },
        create: { classId, studentId: studentFId, fitnessAvg: 100, talmidautAvg: 80, recommendedGrade: 91 },
        update: { fitnessAvg: 100, talmidautAvg: 80, recommendedGrade: 91 },
      });
    });

    afterAll(async () => {
      // Cascade from class deletion cleans everything else
      await prisma.class.deleteMany({ where: { id: classId } });
    });

    it('T1.1 delete ClassEnrollment → enrollment row gone from DB', async () => {
      const before = await prisma.classEnrollment.count({ where: { classId, studentId: studentFId } });
      expect(before).toBe(1);

      await prisma.classEnrollment.delete({
        where: { classId_studentId: { classId, studentId: studentFId } },
      });

      const after = await prisma.classEnrollment.count({ where: { classId, studentId: studentFId } });
      expect(after).toBe(0);
    });

    it('T1.2 Student row still exists — student is a person, not class-owned', async () => {
      const student = await prisma.student.findUnique({ where: { id: studentFId } });
      expect(student).not.toBeNull();
      expect(student?.nationalId).toBe(STUDENT_F_ID);
    });

    it('T1.3 TestResult rows for this class still exist — NOT cascaded by ClassEnrollment deletion', async () => {
      const count = await prisma.testResult.count({
        where: { studentId: studentFId, session: { classId } },
      });
      // Results persist — removing from class does not delete historical data
      expect(count).toBeGreaterThan(0);
    });

    it('T1.4 AttendanceRecord rows still exist — retained for audit trail', async () => {
      const count = await prisma.attendanceRecord.count({ where: { classId, studentId: studentFId } });
      expect(count).toBeGreaterThan(0);
    });

    it('T1.5 TalmidautRecord rows still exist', async () => {
      const count = await prisma.talmidautRecord.count({ where: { classId, studentId: studentFId } });
      expect(count).toBeGreaterThan(0);
    });

    it('T1.6 StudentFinalGrade is CASCADE DELETED when ClassEnrollment is removed (schema fix verified)', async () => {
      // After the schema fix (compound FK ClassEnrollment → StudentFinalGrade CASCADE),
      // deleting a ClassEnrollment row now cascade-deletes the associated StudentFinalGrade.
      // This closes the gap discovered in Phase 1.
      const grade = await prisma.studentFinalGrade.findUnique({
        where: { classId_studentId: { classId, studentId: studentFId } },
      });
      expect(grade).toBeNull();
    });

    it('T1.7 API: GET /classes/:classId/students returns empty (student no longer enrolled)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const students = res.body as Array<{ id: string }>;
      const found = students.find((s) => s.id === studentFId);
      expect(found).toBeUndefined();
    });

    it('T1.8 no orphaned FK references — all surviving rows point to valid existing records', async () => {
      // TestResult → TestSession (session should still exist)
      const orphanedResults = await prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c FROM test_results tr
        LEFT JOIN test_sessions ts ON tr.session_id = ts.id
        WHERE tr.student_id = ${studentFId} AND ts.id IS NULL
      `;
      expect(Number(orphanedResults[0]?.c ?? 0)).toBe(0);
    });
  });

  // ─── Suite 2: Delete entire class (full cascade verification) ────────────

  describe('Suite 2 — delete entire class (full cascade)', () => {
    let classId: string;
    let sessionId: string;
    let auditLogId: string;

    beforeAll(async () => {
      // Create class
      const classRes = await request(app.getHttpServer())
        .post('/api/classes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Cascade Class 2', academicYear: '2024-2025', gradeLevel: 10 })
        .expect(201);
      classId = (classRes.body as { id: string }).id;

      // Re-enroll studentG
      await request(app.getHttpServer())
        .post(`/api/classes/${classId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: 'תלמיד_ז', lastName: 'מחיקה', gender: 'MALE', nationalId: STUDENT_G_ID })
        .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Re-enroll failed ${r.status}`); });

      // Create session + result via API
      const sessRes = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTypeId, semester: 'A' })
        .expect(201);
      sessionId = (sessRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/api/sessions/${sessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentGId, rawValue: 1 })
        .expect(201);

      // Seed additional records via Prisma
      await prisma.attendanceRecord.create({
        data: { classId, studentId: studentGId, date: new Date('2025-02-10'), status: 'PRESENT', semester: Semester.A, sessionId },
      });
      await prisma.talmidautRecord.create({
        data: { classId, studentId: studentGId, participation: 90, uniform: 90, behavior: 90, lessonDate: new Date('2025-02-10') },
      });
      await prisma.studentFinalGrade.upsert({
        where: { classId_studentId: { classId, studentId: studentGId } },
        create: { classId, studentId: studentGId, fitnessAvg: 100, talmidautAvg: 90, recommendedGrade: 95 },
        update: { fitnessAvg: 100, talmidautAvg: 90, recommendedGrade: 95 },
      });
      await prisma.scheduleEntry.create({
        data: { classId, teacherId, dayOfWeek: 0, period: 0, startTime: '08:00', semester: Semester.A },
      });

      // Seed an AuditLog entry referencing this class (for retention check)
      const auditLog = await prisma.auditLog.create({
        data: {
          action: 'GRADE_ENTRY',
          entityType: 'TestResult',
          entityId: `${sessionId}/test`,
          actorId: teacherId,
          newValue: { classId },
        },
      });
      auditLogId = auditLog.id;
    });

    it('T2.1 verify seeded data exists before deletion', async () => {
      expect(await prisma.classEnrollment.count({ where: { classId } })).toBeGreaterThan(0);
      expect(await prisma.testSession.count({ where: { classId } })).toBeGreaterThan(0);
      expect(await prisma.testResult.count({ where: { session: { classId } } })).toBeGreaterThan(0);
      expect(await prisma.attendanceRecord.count({ where: { classId } })).toBeGreaterThan(0);
      expect(await prisma.talmidautRecord.count({ where: { classId } })).toBeGreaterThan(0);
      expect(await prisma.studentFinalGrade.count({ where: { classId } })).toBeGreaterThan(0);
      expect(await prisma.scheduleEntry.count({ where: { classId } })).toBeGreaterThan(0);
    });

    it('T2.2 delete class → class row gone', async () => {
      await prisma.class.delete({ where: { id: classId } });

      const cls = await prisma.class.findUnique({ where: { id: classId } });
      expect(cls).toBeNull();
    });

    it('T2.3 ClassEnrollment cascade-deleted', async () => {
      const count = await prisma.classEnrollment.count({ where: { classId } });
      expect(count).toBe(0);
    });

    it('T2.4 TestSession cascade-deleted', async () => {
      const count = await prisma.testSession.count({ where: { classId } });
      expect(count).toBe(0);
    });

    it('T2.5 TestResult cascade-deleted (via TestSession)', async () => {
      const result = await prisma.testResult.findFirst({ where: { sessionId } });
      expect(result).toBeNull();
    });

    it('T2.6 AttendanceRecord cascade-deleted (classId FK)', async () => {
      const count = await prisma.attendanceRecord.count({ where: { classId } });
      expect(count).toBe(0);
    });

    it('T2.7 TalmidautRecord cascade-deleted', async () => {
      const count = await prisma.talmidautRecord.count({ where: { classId } });
      expect(count).toBe(0);
    });

    it('T2.8 StudentFinalGrade cascade-deleted', async () => {
      const count = await prisma.studentFinalGrade.count({ where: { classId } });
      expect(count).toBe(0);
    });

    it('T2.9 ScheduleEntry cascade-deleted', async () => {
      const count = await prisma.scheduleEntry.count({ where: { classId } });
      expect(count).toBe(0);
    });

    it('T2.10 Student row still exists — person is not deleted when a class is deleted', async () => {
      const student = await prisma.student.findUnique({ where: { id: studentGId } });
      expect(student).not.toBeNull();
    });

    it('T2.11 AuditLog row still exists — not cascaded by class or student deletion', async () => {
      const log = await prisma.auditLog.findUnique({ where: { id: auditLogId } });
      expect(log).not.toBeNull();

      // Cleanup the seeded audit log
      await prisma.auditLog.delete({ where: { id: auditLogId } });
    });

    it('T2.12 referential integrity scan — zero orphaned TestResult rows after full cascade', async () => {
      const orphans = await prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c FROM test_results tr
        LEFT JOIN test_sessions ts ON tr.session_id = ts.id
        WHERE ts.id IS NULL
      `;
      expect(Number(orphans[0]?.c ?? 0)).toBe(0);
    });
  });

  // ─── Suite 3: Delete session only (not the class) ────────────────────────

  describe('Suite 3 — delete session (TestSession cascade, SetNull on AttendanceRecord)', () => {
    let classId: string;
    let sessionId: string;
    let attendanceId: string;

    beforeAll(async () => {
      const classRes = await request(app.getHttpServer())
        .post('/api/classes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'Cascade Class 3', academicYear: '2024-2025', gradeLevel: 10 })
        .expect(201);
      classId = (classRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/api/classes/${classId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: 'תלמיד_ו', lastName: 'מחיקה', gender: 'MALE', nationalId: STUDENT_F_ID })
        .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Re-enroll failed ${r.status}`); });

      const sessRes = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/sessions`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ testTypeId: passfailTypeId, semester: 'A' })
        .expect(201);
      sessionId = (sessRes.body as { id: string }).id;

      // Submit result
      await request(app.getHttpServer())
        .post(`/api/sessions/${sessionId}/results`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: studentFId, rawValue: 1 })
        .expect(201);

      // Seed attendance linked to this session (sessionId FK = SetNull on session delete)
      const att = await prisma.attendanceRecord.create({
        data: {
          classId,
          studentId: studentFId,
          date: new Date('2025-03-01'),
          status: 'PRESENT',
          semester: Semester.A,
          sessionId,
        },
      });
      attendanceId = att.id;
    });

    afterAll(async () => {
      await prisma.class.deleteMany({ where: { id: classId } });
    });

    it('T3.1 delete TestSession → session row gone', async () => {
      await prisma.testSession.delete({ where: { id: sessionId } });
      const sess = await prisma.testSession.findUnique({ where: { id: sessionId } });
      expect(sess).toBeNull();
    });

    it('T3.2 TestResult cascade-deleted when session is deleted', async () => {
      const count = await prisma.testResult.count({ where: { sessionId } });
      expect(count).toBe(0);
    });

    it('T3.3 AttendanceRecord sessionId SET NULL (record persists, link nullified)', async () => {
      const att = await prisma.attendanceRecord.findUnique({ where: { id: attendanceId } });
      expect(att).not.toBeNull();     // record persists
      expect(att?.sessionId).toBeNull(); // sessionId was set to null
    });

    it('T3.4 Class still exists — session deletion does not cascade upward', async () => {
      const cls = await prisma.class.findUnique({ where: { id: classId } });
      expect(cls).not.toBeNull();
    });
  });

  // ─── Suite 4: Student enrolled in two classes — remove from one only ──────

  describe('Suite 4 — student in two classes: removing from one does not affect the other', () => {
    let classAId: string;
    let classBId: string;

    beforeAll(async () => {
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/classes')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ name: 'Cascade Class 4A', academicYear: '2024-2025', gradeLevel: 10 })
          .expect(201),
        request(app.getHttpServer())
          .post('/api/classes')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ name: 'Cascade Class 4B', academicYear: '2024-2025', gradeLevel: 10 })
          .expect(201),
      ]);
      classAId = (resA.body as { id: string }).id;
      classBId = (resB.body as { id: string }).id;

      // Enroll studentG in both classes
      await Promise.all([
        request(app.getHttpServer())
          .post(`/api/classes/${classAId}/students`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ firstName: 'תלמיד_ז', lastName: 'מחיקה', gender: 'MALE', nationalId: STUDENT_G_ID })
          .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Enroll A failed ${r.status}`); }),
        request(app.getHttpServer())
          .post(`/api/classes/${classBId}/students`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ firstName: 'תלמיד_ז', lastName: 'מחיקה', gender: 'MALE', nationalId: STUDENT_G_ID })
          .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Enroll B failed ${r.status}`); }),
      ]);
    });

    afterAll(async () => {
      await prisma.class.deleteMany({ where: { id: { in: [classAId, classBId] } } });
    });

    it('T4.1 student enrolled in both classes initially', async () => {
      const countA = await prisma.classEnrollment.count({ where: { classId: classAId, studentId: studentGId } });
      const countB = await prisma.classEnrollment.count({ where: { classId: classBId, studentId: studentGId } });
      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });

    it('T4.2 remove from classA only → classA enrollment gone, classB enrollment intact', async () => {
      await prisma.classEnrollment.delete({
        where: { classId_studentId: { classId: classAId, studentId: studentGId } },
      });

      const countA = await prisma.classEnrollment.count({ where: { classId: classAId, studentId: studentGId } });
      const countB = await prisma.classEnrollment.count({ where: { classId: classBId, studentId: studentGId } });
      expect(countA).toBe(0);
      expect(countB).toBe(1);
    });

    it('T4.3 Student row still exists (has enrollment in classB)', async () => {
      const student = await prisma.student.findUnique({ where: { id: studentGId } });
      expect(student).not.toBeNull();
    });

    it('T4.4 API: student absent from classA roster', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const students = res.body as Array<{ id: string }>;
      expect(students.find((s) => s.id === studentGId)).toBeUndefined();
    });

    it('T4.5 API: student still present in classB roster', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classBId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const students = res.body as Array<{ id: string }>;
      expect(students.find((s) => s.id === studentGId)).toBeDefined();
    });
  });

  // ─── Suite 5: Global referential integrity scan (final sweep) ────────────

  describe('Suite 5 — post-all-suites referential integrity scan', () => {
    it('T5.1 zero orphaned TestResult rows (every result points to an existing session)', async () => {
      const orphans = await prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c FROM test_results tr
        LEFT JOIN test_sessions ts ON tr.session_id = ts.id
        WHERE ts.id IS NULL
      `;
      expect(Number(orphans[0]?.c ?? 0)).toBe(0);
    });

    it('T5.2 zero orphaned TestSession rows (every session points to an existing class)', async () => {
      const orphans = await prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c FROM test_sessions ts
        LEFT JOIN classes c ON ts.class_id = c.id
        WHERE c.id IS NULL
      `;
      expect(Number(orphans[0]?.c ?? 0)).toBe(0);
    });

    it('T5.3 zero orphaned ClassEnrollment rows', async () => {
      const orphansClass = await prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c FROM class_enrollments ce
        LEFT JOIN classes c ON ce.class_id = c.id
        WHERE c.id IS NULL
      `;
      const orphansStudent = await prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c FROM class_enrollments ce
        LEFT JOIN students s ON ce.student_id = s.id
        WHERE s.id IS NULL
      `;
      expect(Number(orphansClass[0]?.c ?? 0)).toBe(0);
      expect(Number(orphansStudent[0]?.c ?? 0)).toBe(0);
    });

    it('T5.4 zero orphaned StudentFinalGrade rows (every grade points to existing class + student)', async () => {
      const orphansClass = await prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c FROM student_final_grades sfg
        LEFT JOIN classes c ON sfg.class_id = c.id
        WHERE c.id IS NULL
      `;
      const orphansStudent = await prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) AS c FROM student_final_grades sfg
        LEFT JOIN students s ON sfg.student_id = s.id
        WHERE s.id IS NULL
      `;
      expect(Number(orphansClass[0]?.c ?? 0)).toBe(0);
      expect(Number(orphansStudent[0]?.c ?? 0)).toBe(0);
    });
  });
});
