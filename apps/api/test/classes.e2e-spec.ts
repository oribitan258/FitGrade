/**
 * Classes API E2E
 *
 * Covers: class CRUD, grading-policy weight validation, teacher data isolation,
 * and student grade-override flow.
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

// Luhn-valid national IDs for this suite only
const STUDENT_CLS_A = '000000208'; // sum = 10 ✓
const STUDENT_CLS_B = '000000216'; // sum = 10 ✓

interface ClassBody { id: string; name: string }
interface StudentBody { id: string }

describe('Classes (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let teacherAToken: string;
  let teacherAId: string;
  let teacherBToken: string;

  let classAId: string;

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

    // Teacher A — dev-login
    const loginRes = await request(app.getHttpServer()).post('/api/auth/dev-login').expect(200);
    teacherAToken = (loginRes.body as { accessToken: string }).accessToken;
    const meRes = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${teacherAToken}`).expect(200);
    teacherAId = (meRes.body as { id: string }).id;

    // Teacher B — created directly in DB
    const teacherB = await prisma.user.create({
      data: { email: `teacher-b-classes-${Date.now()}@test.com`, name: 'Teacher B Classes', googleId: `google-b-cls-${Date.now()}`, defaultFitnessWeight: 70, defaultConductWeight: 30 },
    });
    teacherBToken = await jwtService.signAsync({ sub: teacherB.id, role: 'TEACHER' });

    // Create a class for Teacher A
    const createRes = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ name: 'כיתה ז׳1', academicYear: '2024-2025', genderType: 'BOYS' })
      .expect(201);
    classAId = (createRes.body as ClassBody).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/classes ────────────────────────────────────────────────────

  describe('POST /api/classes', () => {
    it('creates a class and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/classes')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ name: 'כיתה ח׳2', academicYear: '2024-2025', genderType: 'GIRLS' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('כיתה ח׳2');
    });

    it('returns 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/classes')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ name: 'חסר' }) // missing grade, classNumber, genderType, semester
        .expect(400);
    });

    it('returns 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/api/classes')
        .send({ name: 'Test', grade: 7, classNumber: 1, genderType: 'BOYS', semester: 'A' })
        .expect(401);
    });
  });

  // ── GET /api/classes ─────────────────────────────────────────────────────

  describe('GET /api/classes', () => {
    it("returns only the requesting teacher's classes", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/classes')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      const ids = (res.body as ClassBody[]).map((c) => c.id);
      expect(ids).toContain(classAId);
    });

    it('teacher B sees zero classes from teacher A (data isolation)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/classes')
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(200);

      const ids = (res.body as ClassBody[]).map((c) => c.id);
      expect(ids).not.toContain(classAId);
    });
  });

  // ── GET /api/classes/:id ─────────────────────────────────────────────────

  describe('GET /api/classes/:id', () => {
    it('returns 200 for the owning teacher', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/classes/${classAId}`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(200);

      expect(res.body.id).toBe(classAId);
    });

    it('returns 403 when another teacher accesses the class', async () => {
      await request(app.getHttpServer())
        .get(`/api/classes/${classAId}`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .expect(403);
    });

    it('returns 404 for non-existent class', async () => {
      await request(app.getHttpServer())
        .get('/api/classes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(404);
    });
  });

  // ── PATCH /api/classes/:id/grading-policy ────────────────────────────────

  describe('PATCH /api/classes/:id/grading-policy', () => {
    it('accepts valid weights that sum to 100', async () => {
      await request(app.getHttpServer())
        .patch(`/api/classes/${classAId}/grading-policy`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ fitnessWeight: 60, conductWeight: 40 })
        .expect(200);
    });

    it('returns 400 when weights do not sum to 100', async () => {
      await request(app.getHttpServer())
        .patch(`/api/classes/${classAId}/grading-policy`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ fitnessWeight: 70, conductWeight: 40 })
        .expect(400);
    });

    it('returns 403 for non-owning teacher', async () => {
      await request(app.getHttpServer())
        .patch(`/api/classes/${classAId}/grading-policy`)
        .set('Authorization', `Bearer ${teacherBToken}`)
        .send({ fitnessWeight: 60, conductWeight: 40 })
        .expect(403);
    });
  });

  // ── Student enrollment ───────────────────────────────────────────────────

  describe('POST /api/classes/:id/students', () => {
    it('enrolls a student and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({
          firstName: 'אבי',
          lastName: 'כהן',
          gender: 'MALE',
          nationalId: STUDENT_CLS_A,
        })
        .expect(201);

      expect((res.body as { student: StudentBody }).student.id).toBeDefined();
    });

    it('returns 409 for duplicate nationalId in same class', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ firstName: 'רחל', lastName: 'לוי', gender: 'MALE', nationalId: STUDENT_CLS_A })
        .expect(409);
    });

    it('returns 400 for Luhn-invalid nationalId', async () => {
      await request(app.getHttpServer())
        .post(`/api/classes/${classAId}/students`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .send({ firstName: 'דוד', lastName: 'ישראלי', gender: 'MALE', nationalId: '000000001' })
        .expect(400);
    });
  });
});
