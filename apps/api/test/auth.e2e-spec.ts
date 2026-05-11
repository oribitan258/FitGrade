import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, seedTestTeacher, seedTestStudent, teardown } from './helpers/test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let teacherToken: string;
  let studentToken: string;
  let teacherId: string;
  let studentNationalId: string;
  let studentPassword: string;

  beforeAll(async () => {
    app = await createTestApp();
    const teacher = await seedTestTeacher(app);
    teacherId = teacher.id;
    teacherToken = teacher.accessToken;
    const student = await seedTestStudent(app, { teacherId });
    studentNationalId = student.nationalId;
    studentPassword = student.password;
    studentToken = student.accessToken;
  });

  afterAll(async () => {
    await teardown(app);
  });

  // ── POST /auth/student ───────────────────────────────────────────────────

  describe('POST /auth/student', () => {
    it('returns 200 + access token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/student')
        .send({ nationalId: studentNationalId, password: studentPassword })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('returns 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/student')
        .send({ nationalId: studentNationalId, password: 'wrongpassword' })
        .expect(401);
    });

    it('returns 401 for unknown nationalId', async () => {
      await request(app.getHttpServer())
        .post('/auth/student')
        .send({ nationalId: '999999999', password: 'any' })
        .expect(401);
    });

    it('returns 400 for missing nationalId', async () => {
      await request(app.getHttpServer())
        .post('/auth/student')
        .send({ password: 'test' })
        .expect(400);
    });
  });

  // ── GET /auth/me ─────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns 200 + teacher profile for valid teacher JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(res.body.id).toBe(teacherId);
      expect(res.body.role).toBe('TEACHER');
    });

    it('returns 401 when no token provided', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('returns 401 for malformed token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt')
        .expect(401);
    });

    it('student token is rejected on teacher-only endpoint', async () => {
      // Student accessing teacher-only route → 403
      await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  // ── POST /auth/refresh ───────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns 401 when no refresh cookie is provided', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);
    });
  });

  // ── POST /auth/logout ────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('returns 200 and clears the refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const rawCookie = res.headers['set-cookie'] as unknown;
      const setCookie: string[] = Array.isArray(rawCookie) ? (rawCookie as string[]) : typeof rawCookie === 'string' ? [rawCookie] : [];
      const refreshCookieCleared = setCookie.some(
        (c) => c.includes('refresh_token') && (c.includes('Max-Age=0') || c.includes('Expires=')),
      );
      // Logout clears the cookie — either via Max-Age=0 or clearing the value
      expect(refreshCookieCleared ?? true).toBe(true);
    });
  });
});
