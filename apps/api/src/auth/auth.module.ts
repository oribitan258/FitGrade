import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenBlacklistService } from './refresh-token-blacklist.service';

/**
 * AuthModule — complete Google OAuth 2.0 + JWT authentication.
 *
 * Provides:
 *   - GoogleStrategy: handles /auth/google redirect flow
 *   - JwtStrategy: validates Bearer tokens on protected routes
 *   - AuthService: findOrCreateTeacher, validateStudentLogin, issueTokenPair
 *   - AuthRepository: Prisma queries for auth (PrismaModule is @Global)
 *
 * JwtAuthGuard is NOT provided here — it lives in AppModule as APP_GUARD
 * so NestJS DI can inject it with the Reflector before route resolution.
 *
 * JwtModule is configured with the access token secret and expiry as defaults.
 * AuthService overrides secret/expiry per-call when issuing refresh tokens.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, GoogleStrategy, JwtStrategy, RefreshTokenBlacklistService],
})
export class AuthModule {}
