import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { RefreshTokenBlacklistService } from './refresh-token-blacklist.service';
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
  passwordHash: null,
};

const teacherPayload: JwtPayload = { sub: 'teacher-1', role: 'TEACHER' };

// ─── Mock dependencies ────────────────────────────────────────────────────────

const mockAuthRepository = {
  findOrCreateTeacher: jest.fn(),
  findStudentForNationalIdLogin: jest.fn(),
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
        RefreshTokenBlacklistService,
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
    it('returns the student record when nationalId is valid and found', async () => {
      mockAuthRepository.findStudentForNationalIdLogin.mockResolvedValue(studentLoginRecord);

      const result = await service.validateStudentLogin('123456782');

      expect(result).toEqual(studentLoginRecord);
      expect(mockAuthRepository.findStudentForNationalIdLogin).toHaveBeenCalledWith('123456782');
    });

    it('throws UnauthorizedException when nationalId checksum is invalid', async () => {
      // '000000001' → sum=1, 1%10≠0 → Luhn-invalid (unlike '000000000' which sums to 0)
      await expect(
        service.validateStudentLogin('000000001'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when student is not found', async () => {
      mockAuthRepository.findStudentForNationalIdLogin.mockResolvedValue(null);

      await expect(
        service.validateStudentLogin('123456782'),
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
        { secret: 'test-refresh-secret', algorithms: ['HS256'] },
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
