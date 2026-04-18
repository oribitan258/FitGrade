import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { StudentLoginDto } from './dto/student-login.dto';
import { MobileExchangeDto } from './dto/mobile-exchange.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { TeacherProfileDto } from './dto/teacher-profile.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import type { TeacherRecord } from './auth.types';

/** Refresh token cookie lifetime must match JWT_REFRESH_EXPIRES_IN (7 days). */
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_NAME = 'refresh_token';

/**
 * Short-lived httpOnly cookie used to ferry the access token from the OAuth
 * callback redirect to the frontend WITHOUT exposing it in the URL.
 * The frontend /auth/callback page must call POST /auth/exchange to retrieve
 * the token and clear this cookie. TTL: 2 minutes (covers page load time).
 */
const LOGIN_TOKEN_COOKIE = 'login_token';
const LOGIN_TOKEN_COOKIE_TTL_MS = 2 * 60 * 1000;

/**
 * Short-lived cookie set before mobile OAuth to indicate the callback should
 * redirect to the app's deep-link scheme instead of the web app URL.
 * TTL covers the maximum expected OAuth round-trip (5 minutes).
 */
const MOBILE_AUTH_COOKIE = 'fitgrade_mobile_auth';
const MOBILE_AUTH_COOKIE_TTL_MS = 5 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Authenticated teacher profile ────────────────────────────────────────

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated teacher profile (name, school, avatar)' })
  @ApiResponse({ status: 200, type: TeacherProfileDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMe(@CurrentUser() user: JwtPayload): Promise<TeacherProfileDto> {
    return this.authService.getProfile(user.sub);
  }

  // ─── Teacher Google OAuth ──────────────────────────────────────────────────

  /**
   * Initiates Google OAuth consent screen redirect.
   * GoogleAuthGuard handles the redirect — the handler body never executes.
   */
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login (teacher)' })
  @ApiResponse({ status: 302, description: 'Redirect to Google consent screen' })
  googleLogin(): void {
    // Passport handles the redirect before reaching here.
  }

  /**
   * Mobile app entry point for Google OAuth.
   * Sets a short-lived httpOnly cookie to flag this as a mobile-initiated flow,
   * then redirects to the standard Google OAuth route. The callback uses the
   * cookie to redirect to the app's deep-link scheme (fitgrade://) instead of
   * the web app URL, so expo-web-browser can intercept and return the token.
   */
  @Public()
  @Get('google/mobile')
  @ApiOperation({ summary: 'Initiate Google OAuth login from the mobile app' })
  @ApiResponse({ status: 302, description: 'Redirect to Google consent screen via /auth/google' })
  googleMobileLogin(@Res() res: Response): void {
    res.cookie(MOBILE_AUTH_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: MOBILE_AUTH_COOKIE_TTL_MS,
      path: '/api/auth',
    });
    res.redirect('/api/auth/google');
  }

  /**
   * Google callback — exchanges auth code, upserts teacher, issues JWT pair.
   * Stores refresh token in httpOnly cookie; redirects browser to either:
   *   - The web app at /auth/callback?token=... (standard web flow), OR
   *   - The mobile deep-link fitgrade://auth/callback?token=... (mobile flow,
   *     detected via the MOBILE_AUTH_COOKIE set by googleMobileLogin).
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback — redirects to web app or mobile app with access token' })
  @ApiResponse({ status: 302, description: 'Redirect to /auth/callback?token=... (web) or fitgrade://auth/callback?token=... (mobile)' })
  @ApiResponse({ status: 401, description: 'OAuth failed' })
  async googleCallback(
    @Req() req: Request & { user: TeacherRecord; cookies: Record<string, string> },
    @Res() res: Response,
  ): Promise<void> {
    const payload: JwtPayload = { sub: req.user.id, role: 'TEACHER' };
    const { accessToken, refreshToken } = await this.authService.issueTokenPair(payload);
    this.setRefreshCookie(res, refreshToken);

    const isMobile = req.cookies[MOBILE_AUTH_COOKIE] === '1';
    res.clearCookie(MOBILE_AUTH_COOKIE, { path: '/api/auth' });

    if (isMobile) {
      // Mobile deep-link: expo-web-browser intercepts the fitgrade:// scheme.
      // A one-time code is passed in the URL instead of the access token;
      // the app immediately POSTs the code to /auth/mobile-exchange to retrieve
      // the actual token. The code expires in 2 minutes and is single-use.
      const mobileScheme = this.configService.get<string>('MOBILE_SCHEME', 'fitgrade://');
      const mobileCode = this.authService.createMobileCode(accessToken);
      res.redirect(`${mobileScheme}auth/callback?code=${mobileCode}`);
    } else {
      // Web flow: store token in a short-lived httpOnly cookie scoped to the
      // exchange endpoint. The frontend /auth/callback page calls POST /auth/exchange
      // to retrieve the token — it never appears in the URL, browser history, or logs.
      const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
      res.cookie(LOGIN_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env['NODE_ENV'] === 'production',
        maxAge: LOGIN_TOKEN_COOKIE_TTL_MS,
        path: '/api/auth/exchange',
      });
      res.redirect(`${webUrl}/auth/callback`);
    }
  }

  // ─── OAuth token exchange (web flow) ──────────────────────────────────────

  /**
   * Exchanges the short-lived login_token httpOnly cookie for the access token.
   * Called by the web frontend's /auth/callback page immediately after the
   * OAuth redirect. Clears the cookie after reading it so it cannot be reused.
   *
   * This endpoint exists solely to prevent the access token from ever appearing
   * in a URL (address bar, server logs, Referer headers).
   */
  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange login_token cookie for access token (web OAuth callback)' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Login token cookie missing or expired' })
  exchange(
    @Req() req: Request & { cookies: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ): AuthResponseDto {
    const accessToken = req.cookies[LOGIN_TOKEN_COOKIE];
    if (!accessToken) {
      throw new UnauthorizedException('טוקן כניסה חסר או פג תוקפו');
    }
    // Single-use: clear cookie immediately after reading.
    res.clearCookie(LOGIN_TOKEN_COOKIE, { path: '/api/auth/exchange' });
    return { accessToken };
  }

  // ─── Mobile one-time code exchange ────────────────────────────────────────

  /**
   * Exchanges the one-time code passed in the mobile deep-link URL for the
   * actual access token. The code is valid for 2 minutes and single-use.
   * Called by the Expo app immediately after the deep-link redirect completes.
   */
  @Public()
  @Post('mobile-exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Exchange one-time mobile OAuth code for access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Code missing, expired, or already used' })
  @ApiResponse({ status: 429, description: 'Too many exchange attempts' })
  mobileExchange(@Body() dto: MobileExchangeDto): AuthResponseDto {
    const accessToken = this.authService.redeemMobileCode(dto.code);
    return { accessToken };
  }

  // ─── Dev bypass login (local development only) ────────────────────────────

  /**
   * Issues a teacher JWT for the seeded dummy teacher without Google OAuth.
   * Blocked in production — safe to leave in code.
   */
  @Public()
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV ONLY] Bypass Google OAuth — logs in as dummy teacher' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 403, description: 'Not available in production' })
  async devLogin(
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new ForbiddenException('Dev login is not available in production');
    }
    const { accessToken, refreshToken } = await this.authService.devLogin();
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  // ─── Student login ─────────────────────────────────────────────────────────

  /**
   * Student credential login: classCode + studentCode + password.
   * Issues a read-only JWT scoped to the student's class.
   */
  @Public()
  @Post('student')
  @HttpCode(HttpStatus.OK)
  /** מגבלת ניסיונות: 10 בקשות לדקה לכל IP — מניעת ניחוש סיסמאות */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Student login (class code + student code + password)' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts — try again later' })
  async studentLogin(
    @Body() dto: StudentLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const student = await this.authService.validateStudentLogin(
      dto.classCode,
      dto.studentCode,
      dto.password,
    );
    const payload: JwtPayload = {
      sub: student.studentId,
      role: 'STUDENT',
      classId: student.classId,
    };
    const { accessToken, refreshToken } = await this.authService.issueTokenPair(payload);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  // ─── Token refresh ─────────────────────────────────────────────────────────

  /**
   * Exchanges the httpOnly refresh token cookie for a new access token.
   * No request body needed — the cookie is read automatically.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  /** מגבלת ניסיונות: 20 בקשות לדקה לכל IP — מניעת ניצול טוקני רענון */
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Missing, invalid, or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many refresh attempts — try again later' })
  async refresh(
    @Req() req: Request & { cookies: Record<string, string> },
  ): Promise<AuthResponseDto> {
    const token = req.cookies[REFRESH_COOKIE_NAME];
    if (token === undefined || token === '') {
      throw new UnauthorizedException('טוקן רענון חסר');
    }
    const accessToken = await this.authService.refreshAccessToken(token);
    return { accessToken };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  /**
   * Clears the refresh token cookie.
   * Marked @Public() — clearing a cookie is safe regardless of auth state,
   * and allows logout even when the access token has already expired.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — clears refresh token cookie' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: '/',
    });
  }
}
