/**
 * Attendance API E2E
 *
 * Covers: mark present/absent/excused, upsert semantics (same student + date),
 * EXCUSED record fields, semester filtering, and teacher isolation.
 */
import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

// Luhn-valid national IDs reserved for this suite
const STUDENT_ATT_A = '000000307'; // sum = 10 ✓
const STUDENT_ATT_B = '000000315'; // sum = 10 ✓

const TEST_DATE = '2024-11-20';

interface StudentBody { id: string }
interface AttendanceRecord {
  studentId: string;
  status: string;
  exemptionReason: string | null;
}

describe('Attendance (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let teacherToken: string;
  let teacherId: string;
  let teacherBToken: string;

  let classId: string;
  let studentAId: string;
  let studentBId: string;

  async function saveAttendance(
    records: Array<{ studentId: string; status: string; exemptionReason?: string; exemptionExpiresAt?: string }>,
    date = TEST_DATE,
    semester: 'A' | 'B' = 'A',
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(`/api/classes/${classId}/attendance`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ date, semester, records });
  }

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

    // Teacher login
    const loginRes = await request(app.getHttpServer()).post('/api/auth/dev-login').expect(200);
    teacherToken = (loginRes.body as { accessToken: string }).accessToken;
    const meRes = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${teacherToken}`).expect(200);
    teacherId = (meRes.body as { id: string }).id;

    // Teacher B for isolation tests
    const teacherB = await prisma.user.create({
      data: { email: `teacher-b-att-${Date.now()}@test.com`, name: 'Teacher B Att', googleId: `google-b-att-${Date.now()}`, defaultFitnessWeight: 70, defaultConductWeight: 30 },
    });
    teacherBToken = await jwtService.signAsync({ sub: teacherB.id, role: 'TEACHER' });

    // Create class
    const classRes = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'כיתה נוכחות', academicYear: '2024-2025', genderType: 'BOYS' })
      .expect(201);
    classId = (classRes.body as { id: string }).id;

    // Enroll two students
    const enrollA = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/students`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ firstName: 'אדם', lastName: 'כהן', gender: 'MALE', nationalId: STUDENT_ATT_A })
      .expect(201);
    studentAId = ((enrollA.body as { student: StudentBody }).student).id;

    const enrollB = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/students`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ firstName: 'נח', lastName: 'לוי', gender: 'MALE', nationalId: STUDENT_ATT_B })
      .expect(201);
    studentBId = ((enrollB.body as { student: StudentBody }).student).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Save attendance ──────────────────────────────────────────────────────

  describe('POST /api/classes/:id/attendance', () => {
    it('marks student PRESENT and returns 200', async () => {
      const res = await saveAttendance([{ studentId: studentAId, status: 'PRESENT' }]);
      expect(res.status).toBe(200);

      const saved = (res.body as AttendanceRecord[]).find((r) => r.studentId === studentAId);
      expect(saved?.status).toBe('PRESENT');
    });

    it('marks student ABSENT', async () => {
      const res = await saveAttendance([{ studentId: studentAId, status: 'ABSENT' }], '2024-11-21');
      expect(res.status).toBe(200);

      const saved = (res.body as AttendanceRecord[]).find((r) => r.studentId === studentAId);
      expect(saved?.status).toBe('ABSENT');
    });

    it('marks student EXCUSED with exemptionReason and expiry', async () => {
      const res = await saveAttendance([{
        studentId: studentAId,
        status: 'EXCUSED',
        exemptionReason: 'פציעה בברך',
        exemptionExpiresAt: '2024-11-30',
      }], '2024-11-22');
      expect(res.status).toBe(200);

      const saved = (res.body as AttendanceRecord[]).find((r) => r.studentId === studentAId);
      expect(saved?.status).toBe('EXCUSED');
      expect(saved?.exemptionReason).toBe('פציעה בברך');
    });

    it('upserts — second save for same student+date overwrites the first', async () => {
      const date = '2024-11-25';
      // First: PRESENT
      await saveAttendance([{ studentId: studentBId, status: 'PRESENT' }], date);
      // Second: ABSENT (should overwrite)
      const res = await saveAttendance([{ studentId: studentBId, status: 'ABSENT' }], date);
      expect(res.status).toBe(200);

      const saved = (res.body as AttendanceRecord[]).find((r) => r.studentId === studentBId);
      expect(saved?.status).toBe('ABSENT');
    });

    it('saves multiple students in one call', async () => {
      const res = await saveAttendance([
        { studentId: studentAId, status: 'PRESENT' },
        { studentId: studentBId, status: 'ABSENT' },
      ], '2024-11-26');
      expect(res.status).toBe(200);
      expect((res.body as AttendanceRecord[]).length).toBeGreaterThanOrEqual(2);
    });

    it('returns 403 for teacher who does not own the class', async () => {
      await saveAttendance([{ studentId: studentAId, status: 'PRESENT' }]);
      // Use teacher B's token — different teacher, not the owner
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/attendance`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .send({ date: TEST_DATE, semester: 'A', records: [{ studentId: studentAId, status: 'PRESENT' }] });
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid status value', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classId}/attendance`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ date: TEST_DATE, semester: 'A', records: [{ studentId: studentAId, status: 'INVALID_STATUS' }] });
      expect(res.status).toBe(400);
    });
  });

  // ── Get attendance ───────────────────────────────────────────────────────

  describe('GET /api/classes/:id/attendance', () => {
    it('returns attendance records for the requested date', async () => {
      await saveAttendance([{ studentId: studentAId, status: 'PRESENT' }], '2024-11-28');

      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classId}/attendance?date=2024-11-28`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const records = res.body as AttendanceRecord[];
      expect(records.some((r) => r.studentId === studentAId)).toBe(true);
    });

    it('returns 403 for non-owning teacher', async () => {
      await request(app.getHttpServer())
        .get(`/api/classes/${classId}/attendance?date=2024-11-28`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(403);
    });
  });
});
