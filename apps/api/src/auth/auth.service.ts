import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { RefreshTokenBlacklistService } from './refresh-token-blacklist.service';
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
    private readonly blacklist: RefreshTokenBlacklistService,
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

  // ─── Student (National ID — passwordless) ─────────────────────────────────

  /**
   * Validates student identity via Israeli national ID (ת"ז) + optional password.
   * Pads the ID to 9 digits, runs Israeli Luhn checksum, then looks up the DB.
   *
   * Differentiated error responses (UX-first, accepting enumeration tradeoff):
   *  - Invalid Luhn / format       → 401 'תעודת זהות לא תקינה'
   *  - ID not in DB                → 404 'STUDENT_NOT_FOUND' (machine-readable code,
   *                                   frontend renders the long Hebrew message)
   *  - Wrong password              → 401 'סיסמה שגויה'
   *
   * Enumeration risk is mitigated by the 10 req/min IP throttle on the controller.
   */
  async validateStudentLogin(
    rawNationalId: string,
    rawPassword?: string,
  ): Promise<StudentLoginRecord> {
    const nationalId = rawNationalId.padStart(9, '0');

    if (!AuthService.isValidIsraeliId(nationalId)) {
      this.logger.warn('Failed student login — invalid Israeli ID format');
      throw new UnauthorizedException('תעודת זהות לא תקינה');
    }

    const record = await this.authRepository.findStudentForNationalIdLogin(nationalId);
    if (record === null) {
      this.logger.warn('Failed student login — student not found');
      throw new NotFoundException('STUDENT_NOT_FOUND');
    }

    // Verify password when one is stored; fall back to nationalId for legacy students.
    if (record.passwordHash !== null) {
      const candidate = rawPassword?.trim() || rawNationalId;
      const valid = await bcrypt.compare(candidate, record.passwordHash);
      if (!valid) {
        this.logger.warn('Failed student login — wrong password');
        throw new UnauthorizedException('סיסמה שגויה');
      }
    }

    return record;
  }

  /**
   * Validates an Israeli national ID using the Luhn-variant checksum.
   * Input must be exactly 9 digits (pad with leading zeros if shorter).
   */
  private static isValidIsraeliId(id: string): boolean {
    if (!/^\d{9}$/.test(id)) return false;
    const sum = id.split('').reduce((acc, digit, i) => {
      const val = parseInt(digit, 10) * (i % 2 === 0 ? 1 : 2);
      return acc + (val > 9 ? val - 9 : val);
    }, 0);
    return sum % 10 === 0;
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

  // ─── Onboarding ────────────────────────────────────────────────────────────

  /**
   * Marks the teacher's onboarding as complete.
   * Idempotent — safe to call multiple times.
   * Called by POST /auth/onboarding/complete after the setup form is saved.
   */
  async completeOnboarding(userId: string): Promise<void> {
    await this.authRepository.setOnboardingComplete(userId);
    this.logger.log(`Onboarding marked complete: teacher=${userId}`);
  }

  /**
   * Persists the teacher's default test type IDs for boys/girls classes.
   * Validates that every ID exists in FitnessTestType before writing —
   * a 400 BadRequestException is thrown when any ID is unknown.
   * Empty arrays are accepted and clear the preference.
   */
  async setDefaultTestPreferences(
    userId: string,
    defaultMaleTestIds: string[],
    defaultFemaleTestIds: string[],
  ): Promise<void> {
    const allIds = Array.from(new Set([...defaultMaleTestIds, ...defaultFemaleTestIds]));
    if (allIds.length > 0) {
      const existing = await this.authRepository.findExistingTestTypeIds(allIds);
      if (existing.length !== allIds.length) {
        const unknown = allIds.filter((id) => !existing.includes(id));
        throw new BadRequestException(
          `מזהה מבחן לא קיים: ${unknown.join(', ')}`,
        );
      }
    }
    await this.authRepository.setDefaultTestPreferences(
      userId,
      defaultMaleTestIds,
      defaultFemaleTestIds,
    );
    this.logger.log(
      `Default test preferences saved: teacher=${userId} male=${defaultMaleTestIds.length} female=${defaultFemaleTestIds.length}`,
    );
  }

  // ─── Dev bypass (local development only) ──────────────────────────────────

  /**
   * Issues a teacher JWT for the seeded dummy teacher without Google OAuth.
   * Only callable when NODE_ENV !== 'production' (enforced in the controller).
   */
  async devLogin(simulateFirstLogin: boolean): Promise<TokenPair> {
    const teacher = await this.authRepository.findTeacherByEmail('teacher@test.com');
    if (!teacher) {
      throw new NotFoundException(
        'Dev teacher not found. Run: pnpm prisma:seed',
      );
    }
    if (simulateFirstLogin) {
      await this.authRepository.resetOnboardingState(teacher.id);
      this.logger.warn(`Dev login: reset onboarding → first-time flow for ${teacher.email}`);
    } else {
      await this.authRepository.setOnboardingComplete(teacher.id);
      this.logger.warn(`Dev login: marked onboarding complete for ${teacher.email}`);
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
    const accessSecret  = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpiry  = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const refreshExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    // Each refresh token gets a unique ID (jti) so it can be individually revoked
    // on logout without invalidating other active sessions on other devices.
    const jti = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiry,
        algorithm: 'HS256',
      }),
      this.jwtService.signAsync({ ...payload, jti }, {
        secret: refreshSecret,
        expiresIn: refreshExpiry,
        algorithm: 'HS256',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Verifies a refresh token and issues a new access token.
   * Checks the blacklist first — a revoked token (jti present) is rejected
   * even if its cryptographic signature is still valid.
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessSecret  = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const accessExpiry  = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');

    let payload: JwtPayload & { jti?: string; exp?: number };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('טוקן רענון לא תקף או פג תוקפו');
    }

    // Reject tokens whose jti has been blacklisted (logged-out sessions).
    if (payload.jti !== undefined && this.blacklist.isRevoked(payload.jti)) {
      throw new UnauthorizedException('טוקן רענון בוטל — נא להתחבר מחדש');
    }

    // Strip JWT meta-fields before re-signing — signAsync adds fresh iat/exp/jti
    const { iat: _iat, exp: _exp, jti: _jti, ...freshPayload } = payload;

    return this.jwtService.signAsync(freshPayload, {
      secret: accessSecret,
      expiresIn: accessExpiry,
      algorithm: 'HS256',
    });
  }

  /**
   * Revokes the refresh token identified by the given raw token string.
   * Called by the logout endpoint so stolen refresh tokens cannot be replayed.
   * Safe to call with an invalid/expired token — verification errors are swallowed.
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    try {
      const payload = await this.jwtService.verifyAsync<{ jti?: string; exp?: number }>(
        refreshToken,
        { secret: refreshSecret, algorithms: ['HS256'] },
      );
      if (payload.jti && payload.exp) {
        this.blacklist.revoke(payload.jti, payload.exp * 1000);
      }
    } catch {
      // Invalid or expired token — nothing to revoke.
    }
  }
}
