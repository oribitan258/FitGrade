import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

/**
 * AuthModule — Google OAuth 2.0 + JWT authentication.
 *
 * Phase 8 will add:
 *   - GoogleStrategy (passport-google-oauth20)
 *   - JwtStrategy (validates Bearer tokens)
 *   - JwtAuthGuard (applied globally in AppModule)
 *   - AuthService (upsert teacher, issue access + refresh JWT pair)
 *   - Student auth endpoint (POST /auth/student)
 */
@Module({
  controllers: [AuthController],
})
export class AuthModule {}
