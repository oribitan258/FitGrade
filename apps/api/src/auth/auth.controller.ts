import {
  Controller,
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
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../common/decorators/public.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import type { TeacherRecord } from './auth.types';

/** Refresh token cookie lifetime must match JWT_REFRESH_EXPIRES_IN (7 days). */
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_NAME = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
   * Google callback — exchanges auth code, upserts teacher, issues JWT pair.
   * Stores refresh token in httpOnly cookie; redirects browser to the web app
   * at /auth/callback?token=<accessToken> so the client can store the token.
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback — redirects to web app with access token' })
  @ApiResponse({ status: 302, description: 'Redirect to web app /auth/callback?token=...' })
  @ApiResponse({ status: 401, description: 'OAuth failed' })
  async googleCallback(
    @Req() req: Request & { user: TeacherRecord },
    @Res() res: Response,
  ): Promise<void> {
    const payload: JwtPayload = { sub: req.user.id, role: 'TEACHER' };
    const { accessToken, refreshToken } = await this.authService.issueTokenPair(payload);
    this.setRefreshCookie(res, refreshToken);
    const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
    res.redirect(`${webUrl}/auth/callback?token=${encodeURIComponent(accessToken)}`);
  }

  // ─── Student login ─────────────────────────────────────────────────────────

  /**
   * Student credential login: classCode + studentCode + password.
   * Issues a read-only JWT scoped to the student's class.
   */
  @Public()
  @Post('student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Student login (class code + student code + password)' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Missing, invalid, or expired refresh token' })
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
