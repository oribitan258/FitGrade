import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for Google OAuth endpoints.
 *
 * On GET /auth/google: triggers the redirect to Google's consent screen.
 * On GET /auth/google/callback: exchanges the auth code for tokens and
 * calls GoogleStrategy.validate(), populating req.user.
 *
 * Always used together with @Public() so the global JwtAuthGuard skips these routes.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
