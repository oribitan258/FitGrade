/**
 * Shared bootstrap helpers for API e2e tests.
 *
 * Every e2e spec that imports from this file gets a fresh NestJS application
 * wired with the same global middleware/pipes/filters as production.
 */
import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TeacherSeed {
  id: string;
  accessToken: string;
}

export interface StudentSeed {
  id: string;
  nationalId: string;
  password: string;
  accessToken: string;
}

/** Boots the NestJS app exactly as in production (prefix, pipes, filters, interceptors). */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
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
  return app;
}

/** Returns the dev-login teacher's ID and access token. */
export async function seedTestTeacher(app: INestApplication): Promise<TeacherSeed> {
  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/dev-login')
    .expect(200);
  const accessToken = (loginRes.body as { accessToken: string }).accessToken;

  const meRes = await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  const id = (meRes.body as { id: string }).id;

  return { id, accessToken };
}

/** Luhn-valid national IDs for test students — no collisions with other specs. */
const HELPERS_NATIONAL_IDS = ['000001171', '000001189', '000001197', '000001200'];
let idIndex = 0;

/** Enrolls a student into a new test class and returns their credentials + token. */
export async function seedTestStudent(
  app: INestApplication,
  opts: { teacherId: string },
): Promise<StudentSeed> {
  const prisma = app.get(PrismaService);
  const jwtService = app.get(JwtService);

  // Create a minimal class for this student
  const cls = await prisma.class.create({
    data: {
      name: `Test Class ${Date.now()}`,
      academicYear: '2024-2025',
      genderType: 'BOYS',
      joinCode: `H${Date.now().toString(36).slice(-5).toUpperCase()}`,
      teacherId: opts.teacherId,
    },
  });

  const nationalId = HELPERS_NATIONAL_IDS[idIndex % HELPERS_NATIONAL_IDS.length] ?? '000001171';
  idIndex++;
  const password = 'test-password-123';

  // Create student via API to ensure all business logic (bcrypt, enrollment) runs
  const enroll = await request(app.getHttpServer())
    .post(`/api/classes/${cls.id}/students`)
    .set('Authorization', `Bearer ${(await jwtService.signAsync({ sub: opts.teacherId, role: 'TEACHER' }))}`)
    .send({ firstName: 'Test', lastName: 'Student', gender: 'MALE', nationalId, password })
    .then((r) => r.body as { student: { id: string } });

  const studentId = enroll.student.id;

  // Sign a student JWT directly (avoid full auth flow)
  const accessToken = await jwtService.signAsync({
    sub: studentId,
    role: 'STUDENT',
    classId: cls.id,
  });

  return { id: studentId, nationalId, password, accessToken };
}

/** Closes the app and cleans up resources. */
export async function teardown(app: INestApplication): Promise<void> {
  await app.close();
}
