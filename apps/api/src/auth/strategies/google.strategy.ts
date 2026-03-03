import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

/**
 * Passport strategy for Google OAuth 2.0 teacher login.
 *
 * Flow:
 *   1. GoogleAuthGuard redirects to Google consent screen.
 *   2. Google redirects back to /api/auth/google/callback with an auth code.
 *   3. passport-google-oauth20 exchanges the code for tokens and calls validate().
 *   4. validate() upserts the teacher and returns the record as req.user.
 *   5. AuthController.googleCallback() issues the JWT pair.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const teacher = await this.authService.findOrCreateTeacher({
      googleId: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    });
    done(null, teacher);
  }
}
