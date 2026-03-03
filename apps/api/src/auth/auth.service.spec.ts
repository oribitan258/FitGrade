import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import type { GoogleTeacherProfile, TeacherRecord, StudentLoginRecord } from './auth.types';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const googleProfile: GoogleTeacherProfile = {
  googleId: 'google-123',
  email: 'teacher@school.il',
  name: 'מורה ישראלי',
  avatarUrl: 'https://example.com/avatar.jpg',
};

const teacherRecord: TeacherRecord = {
  id: 'teacher-1',
  email: 'teacher@school.il',
  name: 'מורה ישראלי',
  avatarUrl: 'https://example.com/avatar.jpg',
};

const studentLoginRecord: StudentLoginRecord = {
  studentId: 'student-1',
  classId: 'class-1',
  // bcrypt hash of 'correctPassword' — pre-computed for tests
  passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/pgR6gKHyS',
};

const teacherPayload: JwtPayload = { sub: 'teacher-1', role: 'TEACHER' };

// ─── Mock dependencies ────────────────────────────────────────────────────────

const mockAuthRepository = {
  findOrCreateTeacher: jest.fn(),
  findStudentForLogin: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    };
    return config[key] ?? (() => { throw new Error(`Missing: ${key}`); })();
  }),
  get: jest.fn((key: string, defaultValue: string) => {
    const config: Record<string, string> = {
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
    return config[key] ?? defaultValue;
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── findOrCreateTeacher ────────────────────────────────────────────────────

  describe('findOrCreateTeacher', () => {
    it('delegates to the repository and returns the teacher record', async () => {
      mockAuthRepository.findOrCreateTeacher.mockResolvedValue(teacherRecord);

      const result = await service.findOrCreateTeacher(googleProfile);

      expect(result).toEqual(teacherRecord);
      expect(mockAuthRepository.findOrCreateTeacher).toHaveBeenCalledWith(
        googleProfile,
      );
    });

    it('propagates repository errors', async () => {
      mockAuthRepository.findOrCreateTeacher.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.findOrCreateTeacher(googleProfile)).rejects.toThrow(
        'DB error',
      );
    });
  });

  // ── validateStudentLogin ──────────────────────────────────────────────────

  describe('validateStudentLogin', () => {
    it('returns the student record when credentials are valid', async () => {
      // Use a real bcrypt hash we can match
      const realBcrypt = await import('bcrypt');
      const hash = await realBcrypt.hash('correctPassword', 4); // rounds=4 for test speed
      const record: StudentLoginRecord = { ...studentLoginRecord, passwordHash: hash };

      mockAuthRepository.findStudentForLogin.mockResolvedValue(record);

      const result = await service.validateStudentLogin(
        'AB3X7Q',
        '301',
        'correctPassword',
      );

      expect(result).toEqual(record);
      expect(mockAuthRepository.findStudentForLogin).toHaveBeenCalledWith(
        'AB3X7Q',
        '301',
      );
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const realBcrypt = await import('bcrypt');
      const hash = await realBcrypt.hash('correctPassword', 4);
      const record: StudentLoginRecord = { ...studentLoginRecord, passwordHash: hash };

      mockAuthRepository.findStudentForLogin.mockResolvedValue(record);

      await expect(
        service.validateStudentLogin('AB3X7Q', '301', 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when student/class is not found', async () => {
      mockAuthRepository.findStudentForLogin.mockRejectedValue(
        new UnauthorizedException('קוד כיתה, קוד תלמיד, או סיסמה שגויים'),
      );

      await expect(
        service.validateStudentLogin('BADCODE', '999', 'pass'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── issueTokenPair ────────────────────────────────────────────────────────

  describe('issueTokenPair', () => {
    it('signs both access and refresh tokens and returns them', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token-xyz')
        .mockResolvedValueOnce('refresh-token-xyz');

      const result = await service.issueTokenPair(teacherPayload);

      expect(result.accessToken).toBe('access-token-xyz');
      expect(result.refreshToken).toBe('refresh-token-xyz');
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  // ── refreshAccessToken ────────────────────────────────────────────────────

  describe('refreshAccessToken', () => {
    it('issues a new access token from a valid refresh token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue(teacherPayload);
      mockJwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await service.refreshAccessToken('valid-refresh-token');

      expect(result).toBe('new-access-token');
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-refresh-token',
        { secret: 'test-refresh-secret' },
      );
    });

    it('throws UnauthorizedException when refresh token is expired or invalid', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.refreshAccessToken('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
