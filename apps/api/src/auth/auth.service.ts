import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuthRepository } from './auth.repository';
import type {
  GoogleTeacherProfile,
  TeacherProfileRecord,
  TeacherRecord,
  StudentLoginRecord,
  TokenPair,
} from './auth.types';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** One-time codes issued for the mobile OAuth deep-link exchange. TTL: 2 minutes. */
  private readonly mobileCodeStore = new Map<string, { accessToken: string; expiresAt: number }>();
  private static readonly MOBILE_CODE_TTL_MS = 2 * 60 * 1000;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Teacher (Google OAuth) ────────────────────────────────────────────────

  /**
   * Upserts a teacher record from Google profile data.
   * Called by GoogleStrategy.validate() after Google returns the user info.
   */
  async findOrCreateTeacher(
    profile: GoogleTeacherProfile,
  ): Promise<TeacherRecord> {
    const teacher = await this.authRepository.findOrCreateTeacher(profile);
    this.logger.log(`Teacher authenticated: id=${teacher.id} email=${teacher.email}`);
    return teacher;
  }

  // ─── Student (code + password) ─────────────────────────────────────────────

  /**
   * Validates student credentials.
   * Throws UnauthorizedException on wrong password or unknown student/class.
   * Uses a generic error message to prevent user enumeration.
   */
  async validateStudentLogin(
    classCode: string,
    studentCode: string,
    password: string,
  ): Promise<StudentLoginRecord> {
    let record: StudentLoginRecord;
    try {
      record = await this.authRepository.findStudentForLogin(classCode, studentCode);
    } catch {
      this.logger.warn(
        `Failed student login — student/class not found: classCode=${classCode} studentCode=${studentCode}`,
      );
      throw new UnauthorizedException('קוד כיתה, קוד תלמיד, או סיסמה שגויים');
    }

    const isValid = await bcrypt.compare(password, record.passwordHash);
    if (!isValid) {
      this.logger.warn(
        `Failed student login — wrong password: classCode=${classCode} studentCode=${studentCode}`,
      );
      throw new UnauthorizedException('קוד כיתה, קוד תלמיד, או סיסמה שגויים');
    }

    return record;
  }

  // ─── Teacher profile ───────────────────────────────────────────────────────

  /**
   * Returns the authenticated teacher's public profile.
   * Used by GET /auth/me.
   */
  async getProfile(userId: string): Promise<TeacherProfileRecord> {
    const teacher = await this.authRepository.findTeacherById(userId);
    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }
    return teacher;
  }

  // ─── Dev bypass (local development only) ──────────────────────────────────

  /**
   * Issues a teacher JWT for the seeded dummy teacher without Google OAuth.
   * Only callable when NODE_ENV !== 'production' (enforced in the controller).
   */
  async devLogin(): Promise<TokenPair> {
    const teacher = await this.authRepository.findTeacherByEmail('teacher@test.com');
    if (!teacher) {
      throw new NotFoundException(
        'Dev teacher not found. Run: pnpm prisma:seed',
      );
    }
    const payload: JwtPayload = { sub: teacher.id, role: 'TEACHER' };
    this.logger.warn('Dev login used — should never happen in production');
    return this.issueTokenPair(payload);
  }

  // ─── Mobile one-time code exchange ────────────────────────────────────────

  /**
   * Stores the access token under a random 64-hex-char one-time code.
   * The code is passed in the deep-link URL instead of the token itself.
   * Expires after MOBILE_CODE_TTL_MS (2 minutes).
   */
  createMobileCode(accessToken: string): string {
    const code = randomBytes(32).toString('hex');
    this.mobileCodeStore.set(code, {
      accessToken,
      expiresAt: Date.now() + AuthService.MOBILE_CODE_TTL_MS,
    });
    return code;
  }

  /**
   * Redeems a one-time mobile code and returns the associated access token.
   * Throws UnauthorizedException if the code is missing, expired, or already used.
   */
  redeemMobileCode(code: string): string {
    const entry = this.mobileCodeStore.get(code);
    this.mobileCodeStore.delete(code); // Single-use — delete before checking validity
    if (!entry || Date.now() > entry.expiresAt) {
      throw new UnauthorizedException('קוד אימות נייד חסר, פג תוקפו, או כבר נוצל');
    }
    return entry.accessToken;
  }

  // ─── Token issuing ─────────────────────────────────────────────────────────

  /**
   * Issues an access token (15 min) and a refresh token (7 days) in parallel.
   * The access token is returned in the response body.
   * The refresh token is set as an httpOnly cookie by the controller.
   */
  async issueTokenPair(payload: JwtPayload): Promise<TokenPair> {
    const accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpiry = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const refreshExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiry,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiry,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Verifies a refresh token and issues a new access token.
   * Throws UnauthorizedException if the refresh token is invalid or expired.
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const accessExpiry = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('טוקן רענון לא תקף או פג תוקפו');
    }

    // Strip standard JWT fields before re-signing — signAsync adds fresh iat/exp
    const { iat: _iat, exp: _exp, ...freshPayload } = payload;

    return this.jwtService.signAsync(freshPayload, {
      secret: accessSecret,
      expiresIn: accessExpiry,
    });
  }
}
