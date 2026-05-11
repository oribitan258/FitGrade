import * as request from 'supertest';
import * as XLSX from 'xlsx';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

// ─── Valid Israeli IDs (Luhn-verified) ────────────────────────────────────────
// Luhn: sum of digits where even-index × 1, odd-index × 2 (reduce if > 9) must be divisible by 10

const STUDENT_1_ID = '123456782'; // Luhn ✓
const STUDENT_2_ID = '039337423'; // Luhn ✓
const STUDENT_3_ID = '100000009'; // Luhn ✓
const STUDENT_4_ID = '000000018'; // Luhn ✓ (used in mix import test)
const STUDENT_5_ID = '000000026'; // Luhn ✓ (used in single-add new student test)
const INVALID_LUHN  = '123456789'; // Luhn ✗ — sum=47, not divisible by 10

// ─── Excel helpers ────────────────────────────────────────────────────────────

function buildExcel(rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function studentRow(nationalId: string, firstName: string, lastName: string, gender: string): Record<string, string> {
  return { 'מספר זהות': nationalId, 'שם פרטי': firstName, 'שם משפחה': lastName, 'מין': gender };
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ROW_1 = studentRow(STUDENT_1_ID, 'ישראל', 'ישראלי', 'זכר');
const ROW_2 = studentRow(STUDENT_2_ID, 'שרה',   'כהן',    'נקבה');
const ROW_3 = studentRow(STUDENT_3_ID, 'דוד',   'לוי',    'זכר');
const ROW_4 = studentRow(STUDENT_4_ID, 'רינה',  'אברהם',  'נקבה');
const ROW_5 = studentRow(STUDENT_5_ID, 'מיכל',  'גולן',   'נקבה');

const BODY_5 = { firstName: 'מיכל', lastName: 'גולן', gender: 'FEMALE', nationalId: STUDENT_5_ID };

// ─── Suite setup ──────────────────────────────────────────────────────────────

describe('Enrollment & Import (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacherToken: string;
  let studentToken: string;
  let classAId: string;
  let classBId: string;

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

    // Student-role JWT for auth guard tests (role: STUDENT, no real student record needed)
    const jwtService = app.get(JwtService);
    studentToken = jwtService.sign({ sub: 'fake-student', role: 'STUDENT' });

    // Create two isolated test classes
    const resA = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'E2E Class A', academicYear: '2024-2025', gradeLevel: 10 })
      .expect(201);
    classAId = (resA.body as { id: string }).id;

    const resB = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'E2E Class B', academicYear: '2024-2025', gradeLevel: 10 })
      .expect(201);
    classBId = (resB.body as { id: string }).id;
  });

  afterAll(async () => {
    const allTestIds = [STUDENT_1_ID, STUDENT_2_ID, STUDENT_3_ID, STUDENT_4_ID, STUDENT_5_ID];

    // Delete in FK-safe order: enrollments → students → classes
    await prisma.classEnrollment.deleteMany({ where: { classId: { in: [classAId, classBId] } } });
    await prisma.student.deleteMany({ where: { nationalId: { in: allTestIds } } });
    await prisma.class.deleteMany({ where: { id: { in: [classAId, classBId] } } });

    await app.close();
  });

  // ─── Suite 1: Excel Import — Valid Files ────────────────────────────────────
  // State after this suite: classA=[s1,s2,s3], classB=[s1,s2,s4]

  describe('Suite 1 — Excel import: valid files', () => {
    it('T1.1 imports 3 new students into classA (added:3)', async () => {
      const file = buildExcel([ROW_1, ROW_2, ROW_3]);
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);

      const body = res.body as { added: number; existing: number; reEnrolled: number; errors: unknown[] };
      expect(body.added).toBe(3);
      expect(body.existing).toBe(0);
      expect(body.reEnrolled).toBe(0);
      expect(body.errors).toHaveLength(0);
    });

    it('T1.2 re-importing same 3 students returns existing:3', async () => {
      const file = buildExcel([ROW_1, ROW_2, ROW_3]);
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);

      const body = res.body as { added: number; existing: number; reEnrolled: number; errors: unknown[] };
      expect(body.added).toBe(0);
      expect(body.existing).toBe(3);
      expect(body.reEnrolled).toBe(0);
      expect(body.errors).toHaveLength(0);
    });

    it('T1.3 importing classA student into classB returns reEnrolled:1 (student1)', async () => {
      const file = buildExcel([ROW_1]);
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classBId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);

      const body = res.body as { added: number; existing: number; reEnrolled: number; errors: unknown[] };
      expect(body.added).toBe(0);
      expect(body.existing).toBe(0);
      expect(body.reEnrolled).toBe(1);
      expect(body.errors).toHaveLength(0);
    });

    it('T1.3b cross-class import did NOT create a duplicate Student row', async () => {
      const count = await prisma.student.count({ where: { nationalId: STUDENT_1_ID } });
      expect(count).toBe(1);
    });

    it('T1.4 mix import to classB: 1 new (s4) + 1 existing (s1) + 1 re-enrolled (s2)', async () => {
      // s1 = already in classB → existing
      // s2 = in classA, not classB → reEnrolled
      // s4 = brand new → added
      const file = buildExcel([ROW_4, ROW_1, ROW_2]);
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classBId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);

      const body = res.body as { added: number; existing: number; reEnrolled: number; errors: unknown[] };
      expect(body.added).toBe(1);
      expect(body.existing).toBe(1);
      expect(body.reEnrolled).toBe(1);
      expect(body.errors).toHaveLength(0);
    });
  });

  // ─── Suite 2: Excel Import — Malformed Files ────────────────────────────────

  describe('Suite 2 — Excel import: malformed files', () => {
    it('T2.1 Excel missing מספר זהות column returns 400', async () => {
      const ws = XLSX.utils.json_to_sheet([{ 'שם פרטי': 'ישראל', 'שם משפחה': 'ישראלי', 'מין': 'זכר' }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'S');
      const file = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'bad.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(400);
    });

    it('T2.2 Excel with Luhn-invalid ID returns 200 with errors[], added:0', async () => {
      const file = buildExcel([studentRow(INVALID_LUHN, 'פלוני', 'אלמוני', 'זכר')]);
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);

      const body = res.body as { added: number; errors: Array<{ reason: string }> };
      expect(body.added).toBe(0);
      expect(body.errors.length).toBeGreaterThan(0);
      expect(body.errors[0]?.reason).toBeTruthy();
    });

    it('T2.3 Excel with 10-digit nationalId returns 200 with row in errors[]', async () => {
      const file = buildExcel([studentRow('1234567890', 'פלוני', 'אלמוני', 'זכר')]);
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);

      const body = res.body as { added: number; errors: unknown[] };
      expect(body.added).toBe(0);
      expect(body.errors.length).toBeGreaterThan(0);
    });

    it('T2.4 non-Excel binary returns a non-2xx status', async () => {
      const fakePdf = Buffer.from('%PDF-1.4 fake pdf content here');
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', fakePdf, { filename: 'file.pdf', contentType: 'application/pdf' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('T2.5 Excel with only header row (no data) returns 400', async () => {
      const ws = XLSX.utils.aoa_to_sheet([['מספר זהות', 'שם פרטי', 'שם משפחה', 'מין']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'S');
      const file = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'header-only.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(400);
    });
  });

  // ─── Suite 3: Single Student Add ────────────────────────────────────────────
  // State entering suite: classA=[s1,s2,s3], classB=[s1,s2,s4]

  describe('Suite 3 — Single student add (POST JSON)', () => {
    it('T3.1 new student (s5) added to classA → 201 reEnrolled:false', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(BODY_5)
        .expect(201);

      const body = res.body as { student: unknown; reEnrolled: boolean };
      expect(body.reEnrolled).toBe(false);
      expect(body.student).toBeDefined();
    });

    it('T3.2 adding s1 to classA again → 409 Hebrew conflict message', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: 'ישראל', lastName: 'ישראלי', gender: 'MALE', nationalId: STUDENT_1_ID })
        .expect(409);

      const body = res.body as { message: string };
      expect(body.message).toMatch(/כבר רשום/);
    });

    it('T3.3 adding s3 (in classA, not classB) to classB → 200 reEnrolled:true', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classBId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: 'דוד', lastName: 'לוי', gender: 'MALE', nationalId: STUDENT_3_ID })
        .expect(200);

      const body = res.body as { reEnrolled: boolean; studentName: string };
      expect(body.reEnrolled).toBe(true);
      expect(body.studentName).toBe('דוד לוי');
    });

    it('T3.4 re-enrollment did NOT create a duplicate Student DB row for s3', async () => {
      const count = await prisma.student.count({ where: { nationalId: STUDENT_3_ID } });
      expect(count).toBe(1);
    });

    it('T3.5 missing nationalId field → 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: 'ישראל', lastName: 'ישראלי', gender: 'MALE' })
        .expect(400);
    });

    it('T3.6 non-numeric nationalId "abc123" → 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: 'ישראל', lastName: 'ישראלי', gender: 'MALE', nationalId: 'abc123' })
        .expect(400);
    });

    it('T3.7 Luhn-invalid nationalId "123456789" → 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ firstName: 'ישראל', lastName: 'ישראלי', gender: 'MALE', nationalId: INVALID_LUHN })
        .expect(400);
    });
  });

  // ─── Suite 4: Class Creation + Import Wizard ────────────────────────────────

  describe('Suite 4 — Class creation + import wizard back-to-back', () => {
    let wizardClassId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/classes')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ name: 'E2E Wizard Class', academicYear: '2024-2025', gradeLevel: 9 })
        .expect(201);
      wizardClassId = (res.body as { id: string }).id;
    });

    afterAll(async () => {
      await prisma.classEnrollment.deleteMany({ where: { classId: wizardClassId } });
      await prisma.class.deleteMany({ where: { id: wizardClassId } });
    });

    it('T4.1 class created → Excel upload → students appear in correct class', async () => {
      const file = buildExcel([ROW_1, ROW_2]);

      await prisma.classEnrollment.deleteMany({
        where: { student: { nationalId: { in: [STUDENT_1_ID, STUDENT_2_ID] } }, classId: wizardClassId },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/classes/${wizardClassId}/students/import`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(200);

      const body = res.body as { added: number; reEnrolled: number };
      expect(body.added + body.reEnrolled).toBe(2);

      const listRes = await request(app.getHttpServer())
        .get(`/api/classes/${wizardClassId}/students`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const students = listRes.body as Array<{ nationalId: string }>;
      const ids = students.map((s) => s.nationalId);
      expect(ids).toContain(STUDENT_1_ID.padStart(9, '0'));
      expect(ids).toContain(STUDENT_2_ID.padStart(9, '0'));
    });
  });

  // ─── Suite 5: Auth & Authorization Guards ───────────────────────────────────

  describe('Suite 5 — Auth and authorization', () => {
    it('T5.1 import without JWT → 401', async () => {
      const file = buildExcel([ROW_1]);
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(401);
    });

    it('T5.2 import with student-role JWT → 403', async () => {
      const file = buildExcel([ROW_1]);
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students/import`)
        .set('Authorization', `Bearer ${studentToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(403);
    });

    it('T5.3 import to non-existent class → 404', async () => {
      const file = buildExcel([ROW_1]);
      await request(app.getHttpServer())
        .post('/api/classes/00000000-0000-0000-0000-000000000000/students/import')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', file, { filename: 'students.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        .expect(404);
    });

    it('T5.4 single add without JWT → 401', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .send(BODY_5)
        .expect(401);
    });

    it('T5.5 single add with student-role JWT → 403', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(BODY_5)
        .expect(403);
    });
  });
});
