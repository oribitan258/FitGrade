import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * AuthController — placeholder for Google OAuth 2.0 flow.
 *
 * Full implementation (Passport GoogleStrategy, JWT issuing, refresh tokens)
 * added in the auth phase. These stubs establish the routes so the module
 * compiles and Swagger documents the intended endpoints.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  /**
   * Redirects the browser to Google's OAuth consent screen.
   * In production: protected by @UseGuards(GoogleAuthGuard).
   */
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth login (teacher)' })
  @ApiResponse({ status: 302, description: 'Redirect to Google consent screen' })
  googleLogin(): { message: string } {
    // Passport GoogleAuthGuard will handle the redirect.
    // Returning a placeholder until the guard is added.
    return { message: 'Google OAuth not yet configured' };
  }

  /**
   * Google OAuth callback — exchanges code for tokens, issues JWT.
   * In production: protected by @UseGuards(GoogleAuthGuard).
   */
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 200, description: 'JWT issued, redirect to dashboard' })
  googleCallback(): { message: string } {
    return { message: 'Google OAuth callback not yet configured' };
  }
}
