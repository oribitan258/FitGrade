import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

/**
 * Passport strategy that validates the short-lived access token.
 *
 * Extracts the Bearer token from the Authorization header, verifies the
 * signature using JWT_ACCESS_SECRET, and sets req.user to the decoded payload.
 * Used by JwtAuthGuard on every protected route.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // Explicit algorithm whitelist prevents the "alg:none" and RS256→HS256
      // confusion attacks where an attacker substitutes the algorithm header.
      algorithms: ['HS256'],
    });
  }

  /**
   * Called by Passport after the JWT signature is verified.
   * The return value becomes req.user — the @CurrentUser() decorator reads it.
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
