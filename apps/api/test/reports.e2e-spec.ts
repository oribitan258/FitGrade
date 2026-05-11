/**
 * Reports API E2E
 *
 * Covers three invariants:
 *
 * 1. Final grade computation weighting
 *    - recommendedFinalGrade = round(fitnessAvg × fitnessWeight% + conductScore × conductWeight%)
 *    - Verified against exact values with default weights (fitness=55, conduct=45)
 *    - Verified with no talmidaut (conductScore=0 → grade depends only on fitness)
 *    - Verified with absences (conductScore penalised by ABSENCE_PENALTY_PER_DAY=5)
 *
 * 2. Teacher overrides persisting correctly
 *    - PATCH /reports/class/:id saves teacherFinalGrade + verbalComment
 *    - Subsequent GET returns the saved values
 *    - Second PATCH with new values updates correctly
 *    - Isolation: another teacher cannot PATCH or GET a class they don't own (403)
 *
 * 3. CSV export validation
 *    - Content-Type: text/csv
 *    - Byte 0 is the UTF-8 BOM (0xEF 0xBB 0xBF)
 *    - Hebrew column headers present in first line after BOM
 *    - Student data rows present
 *    - Empty class (semester with no sessions) returns [] from report → CSV has header only
 *
 * Precision guarantee:
 *   ABSENCE_PENALTY_PER_DAY = 5   (from reports.service.ts)
 *   Default weights: fitness=55, conduct=45  (from User model @default)
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
const STUDENT_L_ID = '000000141'; // sum = 10 ✓  (formula test)
const STUDENT_M_ID = '000000158'; // sum = 10 ✓  (override test)
const STUDENT_N_ID = '000000166'; // sum = 10 ✓  (absence-penalty test)
const STUDENT_O_ID = '000000174'; // sum = 10 ✓  (no-talmidaut test)

// ─── Typed helpers ────────────────────────────────────────────────────────────

interface ClassBody   { id: string }
interface StudentBody { id: string }
interface SessionBody { id: string }

interface ReportRow {
  studentId:            string;
  firstName:            string;
  lastName:             string;
  studentCode:          string;
  fitnessAvg:           number;
  conductScore:         number;
  fitnessWeight:        number;
  conductWeight:        number;
  recommendedFinalGrade: number;
  teacherFinalGrade:    number | null;
  verbalComment:        string | null;
  suggestedComment:     string;
  unexcusedAbsences:    number;
  totalLessons:         number;
  testBreakdown:        Array<{ testTypeId: string; nameHe: string; grade: number }>;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Reports (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Teacher A (dev-login) — owns all test classes in this suite
  let teacherAToken: string;
  let teacherAId: string;

  // Teacher B (Prisma-created) — used for isolation tests
  let teacherBToken: string;
  let teacherBId: string;

  // Class IDs
  let formulaClassId: string;  // formula + weight tests
  let overrideClassId: string; // teacher override tests
  let absenceClassId: string;  // absence-penalty test
  let noTalmidatClassId: string; // no-talmidaut (conductScore=0) test

  // Student IDs within each class
  let studentLId: string;
  let studentMId: string;
  let studentNId: string;
  let studentOId: string;

  // PASS_FAIL test type
  let passfailTypeId: string;

  // ── helpers ──────────────────────────────────────────────────────────────────

  async function createClass(name: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ name, academicYear: '2024-2025', gradeLevel: 10 })
      .expect(201);
    return (res.body as ClassBody).id;
  }

  async function enrollStudent(classId: string, nationalId: string, firstName: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/students`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ firstName, lastName: 'דוח', gender: 'MALE', nationalId })
      .expect((r) => { if (r.status !== 201 && r.status !== 200) throw new Error(`Enroll failed: ${r.status}`); });
    return (res.body as { student: StudentBody }).student.id;
  }

  async function createSessionAndResult(classId: string, studentId: string, rawValue: number, semester: 'A' | 'B' = 'A'): Promise<string> {
    const sessRes = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/sessions`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ testTypeId: passfailTypeId, semester })
      .expect(201);
    const sessionId = (sessRes.body as SessionBody).id;

    await request(app.getHttpServer())
      .post(`/api/sessions/${sessionId}/results`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ studentId, rawValue })
      .expect(201);

    return sessionId;
  }

  async function addTalmidaut(classId: string, studentId: string, score: number): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/classes/${classId}/students/${studentId}/talmidaut`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ participation: score, uniform: score, behavior: score })
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

    // Teacher A (dev-login)
    const loginRes = await request(app.getHttpServer()).post('/api/auth/dev-login').expect(200);
    teacherAToken = (loginRes.body as { accessToken: string }).accessToken;
    const meRes = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${teacherAToken}`).expect(200);
    teacherAId = (meRes.body as { id: string }).id;

    // Teacher B (isolation tests)
    const ts = Date.now();
    const teacherBRecord = await prisma.user.create({
      data: { email: `teacher-b-${ts}@e2e-reports.test`, name: 'Teacher B (Reports)', googleId: `e2e-reports-b-${ts}` },
    });
    teacherBId    = teacherBRecord.id;
    teacherBToken = jwtService.sign({ sub: teacherBId, role: 'TEACHER' });

    // PASS_FAIL test type
    const typesRes = await request(app.getHttpServer()).get('/api/tests/types').set('Authorization', `Bearer ${teacherAToken}`).expect(200);
    const pf = (typesRes.body as Array<{ id: string; inputType: string }>).find((t) => t.inputType === 'PASS_FAIL');
    if (!pf) throw new Error('No PASS_FAIL test type seeded');
    passfailTypeId = pf.id;

    // ── formulaClass: student L with grade=100, talmidaut composite=80 ────────
    formulaClassId  = await createClass('Reports Formula Class');
    studentLId      = await enrollStudent(formulaClassId, STUDENT_L_ID, 'תלמיד_ל');
    await createSessionAndResult(formulaClassId, studentLId, 1); // grade=100
    await addTalmidaut(formulaClassId, studentLId, 80);           // composite=(80+80+80)/3=80

    // ── overrideClass: student M with grade=100, talmidaut=80 (for overrides) ─
    overrideClassId = await createClass('Reports Override Class');
    studentMId      = await enrollStudent(overrideClassId, STUDENT_M_ID, 'תלמיד_מ');
    await createSessionAndResult(overrideClassId, studentMId, 1);
    await addTalmidaut(overrideClassId, studentMId, 80);

    // ── absenceClass: student N with grade=100, talmidaut=80, 2 ABSENT records ─
    absenceClassId  = await createClass('Reports Absence Class');
    studentNId      = await enrollStudent(absenceClassId, STUDENT_N_ID, 'תלמיד_נ');
    await createSessionAndResult(absenceClassId, studentNId, 1);
    await addTalmidaut(absenceClassId, studentNId, 80);
    // Seed 2 ABSENT attendance records directly via Prisma
    await prisma.attendanceRecord.createMany({
      data: [
        { classId: absenceClassId, studentId: studentNId, date: new Date('2025-01-10'), status: 'ABSENT', semester: Semester.A },
        { classId: absenceClassId, studentId: studentNId, date: new Date('2025-01-17'), status: 'ABSENT', semester: Semester.A },
      ],
    });

    // ── noTalmidatClass: student O with grade=100, NO talmidaut ──────────────
    noTalmidatClassId = await createClass('Reports No-Talmidaut Class');
    studentOId        = await enrollStudent(noTalmidatClassId, STUDENT_O_ID, 'תלמיד_ס');
    await createSessionAndResult(noTalmidatClassId, studentOId, 1);
    // No talmidaut added
  }, 90_000);

  afterAll(async () => {
    // Cascade via class deletion + Teacher B cascade
    const classIds = [formulaClassId, overrideClassId, absenceClassId, noTalmidatClassId];
    await prisma.attendanceRecord.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.testResult.deleteMany({ where: { session: { classId: { in: classIds } } } });
    await prisma.testSession.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.talmidautRecord.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.studentFinalGrade.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.classEnrollment.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.class.deleteMany({ where: { id: { in: classIds } } });
    await prisma.student.deleteMany({
      where: { nationalId: { in: [STUDENT_L_ID, STUDENT_M_ID, STUDENT_N_ID, STUDENT_O_ID] } },
    });
    await prisma.user.deleteMany({ where: { id: teacherBId } });
    await app.close();
  }, 30_000);

  // ─── Suite 1 — Final grade computation weighting ─────────────────────────

  describe('Suite 1 — final grade computation weighting', () => {
    /**
     * Precision table (all values deterministic):
     *
     * formulaClass — studentL:
     *   fitnessAvg      = 100  (PASS_FAIL pass, single test, best = 100)
     *   talmidautAvg    = 80   (composite = (80+80+80)/3 = 80)
     *   absences        = 0
     *   conductScore    = max(0, min(100, 80 − 0×5)) = 80
     *   fitnessWeight   = 55%  (teacher default)
     *   conductWeight   = 45%  (teacher default)
     *   recommendedFinalGrade = round(100×0.55 + 80×0.45) = round(55 + 36) = 91
     */

    it('T1.1 GET /reports/class/:id — returns one row per enrolled student', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const rows = res.body as ReportRow[];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.studentId).toBe(studentLId);
    });

    it('T1.2 fitnessAvg = 100 (PASS_FAIL rawValue=1 → grade=100)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect((res.body as ReportRow[])[0]?.fitnessAvg).toBe(100);
    });

    it('T1.3 conductScore = 80 (talmidautAvg=80, 0 absences → no penalty)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect((res.body as ReportRow[])[0]?.conductScore).toBe(80);
    });

    it('T1.4 fitnessWeight=55, conductWeight=45 (teacher global defaults)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const row = (res.body as ReportRow[])[0]!;
      expect(row.fitnessWeight).toBe(55);
      expect(row.conductWeight).toBe(45);
    });

    it('T1.5 recommendedFinalGrade = round(100×0.55 + 80×0.45) = 91', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect((res.body as ReportRow[])[0]?.recommendedFinalGrade).toBe(91);
    });

    it('T1.6 teacherFinalGrade = null (no override set yet)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect((res.body as ReportRow[])[0]?.teacherFinalGrade).toBeNull();
    });

    it('T1.7 suggestedComment is a non-empty Hebrew string from the Ministry bank', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const comment = (res.body as ReportRow[])[0]?.suggestedComment;
      expect(typeof comment).toBe('string');
      expect(comment!.length).toBeGreaterThan(0);
    });

    it('T1.8 absence penalty: 2 absences → conductScore = 80 − (2×5) = 70', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${absenceClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const row = (res.body as ReportRow[])[0]!;
      expect(row.unexcusedAbsences).toBe(2);
      expect(row.conductScore).toBe(70); // 80 − 2×5 = 70
      // recommendedFinalGrade = round(100×0.55 + 70×0.45) = round(55 + 31.5) = round(86.5) = 87
      expect(row.recommendedFinalGrade).toBe(87);
    });

    it('T1.9 no talmidaut → conductScore=0, recommendedFinalGrade = round(100×0.55 + 0×0.45) = 55', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${noTalmidatClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const row = (res.body as ReportRow[])[0]!;
      expect(row.conductScore).toBe(0);
      expect(row.recommendedFinalGrade).toBe(55); // round(100×0.55 + 0×0.45) = 55
    });

    it('T1.10 report for semester=B with no Sem-B sessions → returns empty array (ghost-data guard)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}?semester=B`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect(res.body as ReportRow[]).toHaveLength(0);
    });
  });

  // ─── Suite 2 — Teacher overrides persisting correctly ────────────────────

  describe('Suite 2 — teacher grade overrides', () => {
    it('T2.1 initial state: teacherFinalGrade=null, verbalComment=null', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const row = (res.body as ReportRow[])[0]!;
      expect(row.teacherFinalGrade).toBeNull();
      expect(row.verbalComment).toBeNull();
    });

    it('T2.2 PATCH sets teacherFinalGrade and verbalComment → 204', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({
          grades: [{
            studentId: studentMId,
            teacherFinalGrade: 95,
            verbalComment: 'מראה התייחסות רצינית ומוטיבציה גבוהה',
          }],
        })
        .expect(204);
    });

    it('T2.3 subsequent GET returns saved teacherFinalGrade=95 and verbalComment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const row = (res.body as ReportRow[])[0]!;
      expect(row.teacherFinalGrade).toBe(95);
      expect(row.verbalComment).toBe('מראה התייחסות רצינית ומוטיבציה גבוהה');
    });

    it('T2.4 recommendedFinalGrade remains 91 — override does not mutate the computed grade', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect((res.body as ReportRow[])[0]?.recommendedFinalGrade).toBe(91);
    });

    it('T2.5 second PATCH with different values → updates correctly', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({
          grades: [{ studentId: studentMId, teacherFinalGrade: 88, verbalComment: 'שיפור ניכר לאורך השנה – כל הכבוד' }],
        })
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const row = (res.body as ReportRow[])[0]!;
      expect(row.teacherFinalGrade).toBe(88);
      expect(row.verbalComment).toBe('שיפור ניכר לאורך השנה – כל הכבוד');
    });

    it('T2.6 teacherFinalGrade=101 → 400 (out of range)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ grades: [{ studentId: studentMId, teacherFinalGrade: 101 }] })
        .expect(400);
    });

    it('T2.7 teacherFinalGrade=-1 → 400 (below minimum)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ grades: [{ studentId: studentMId, teacherFinalGrade: -1 }] })
        .expect(400);
    });

    it('T2.8 Teacher B trying to PATCH Teacher A class → 403 (isolation)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .send({ grades: [{ studentId: studentMId, teacherFinalGrade: 50 }] })
        .expect(403);
    });

    it('T2.9 Teacher B trying to GET Teacher A class report → 403 (isolation)', async () => {
      await request(app.getHttpServer())
        .get(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(403);
    });

    it('T2.10 empty grades array in PATCH body → 400 (ArrayMinSize(1))', async () => {
      await request(app.getHttpServer())
        .patch(`/api/reports/class/${overrideClassId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ grades: [] })
        .expect(400);
    });
  });

  // ─── Suite 3 — CSV export validation ─────────────────────────────────────

  describe('Suite 3 — CSV export', () => {
    it('T3.1 Content-Type header contains text/csv', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/i);
    });

    it('T3.2 response body starts with UTF-8 BOM (U+FEFF / bytes 0xEF 0xBB 0xBF)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .buffer(true)
        .expect(200);

      // Check as Unicode character (simpler)
      expect(res.text.charCodeAt(0)).toBe(0xfeff);

      // Also verify as raw bytes for completeness
      const buf = Buffer.from(res.text, 'utf8');
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);
    });

    it('T3.3 first line (after BOM) contains all required Hebrew headers', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const withoutBom = res.text.replace('﻿', '');
      const headerLine = withoutBom.split('\r\n')[0]!;

      expect(headerLine).toContain('שם פרטי');
      expect(headerLine).toContain('שם משפחה');
      expect(headerLine).toContain('קוד תלמיד');
      expect(headerLine).toContain('ממוצע כושר');
      expect(headerLine).toContain('ניהול');
      expect(headerLine).toContain('ציון מומלץ');
      expect(headerLine).toContain('ציון מורה');
      expect(headerLine).toContain('הערה');
    });

    it('T3.4 data rows are present — one row per enrolled student after the header', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const withoutBom = res.text.replace('﻿', '');
      const lines = withoutBom.split('\r\n').filter((l) => l.length > 0);
      // line[0] = header, lines[1..n] = data
      expect(lines.length).toBe(2); // 1 header + 1 student
    });

    it('T3.5 data row contains correct fitnessAvg (100) and recommendedFinalGrade (91)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const withoutBom = res.text.replace('﻿', '');
      const dataLine = withoutBom.split('\r\n')[1]!; // first data row
      expect(dataLine).toContain('100'); // fitnessAvg
      expect(dataLine).toContain('91');  // recommendedFinalGrade
    });

    it('T3.6 Content-Disposition header is set for file download', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect(res.headers['content-disposition']).toMatch(/attachment/i);
      expect(res.headers['content-disposition']).toContain('.csv');
    });

    it('T3.7 CSV for class with no sessions for requested semester → header only (empty data)', async () => {
      // formulaClassId has Sem-A sessions only; requesting Sem-B returns 0 report rows
      const res = await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv?semester=B`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      // Service returns [] for semester with no sessions → CSV has BOM + header only
      const withoutBom = res.text.replace('﻿', '');
      const lines = withoutBom.split('\r\n').filter((l) => l.length > 0);

      // The controller always emits the header even when rows is empty (header is built from HEADERS const)
      // If the report returns [], the csv = '﻿' + headerLine (no data lines follow)
      expect(lines.length).toBeLessThanOrEqual(1); // header only
    });

    it('T3.8 CSV request without JWT → 401', async () => {
      await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv`)
        .expect(401);
    });

    it('T3.9 Teacher B cannot download Teacher A class CSV → 403', async () => {
      await request(app.getHttpServer())
        .get(`/api/reports/class/${formulaClassId}/export/csv`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(403);
    });
  });

  // ─── Suite 4 — Comments bank ──────────────────────────────────────────────

  describe('Suite 4 — comments bank', () => {
    it('T4.1 GET /reports/comments-bank → returns non-empty array of Hebrew strings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/comments-bank')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const comments = res.body as string[];
      expect(Array.isArray(comments)).toBe(true);
      expect(comments.length).toBeGreaterThan(0);
      expect(typeof comments[0]).toBe('string');
    });

    it('T4.2 comments bank includes absence-related Hebrew comment', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/comments-bank')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const comments = res.body as string[];
      expect(comments.some((c) => c.includes('להעדר'))).toBe(true);
    });
  });
});
