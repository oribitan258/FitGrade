import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Extracts the authenticated user's JWT payload from the request object.
 *
 * Populated by JwtStrategy (added in the auth phase). Until auth is wired,
 * the value will be undefined — controllers that depend on it require auth.
 *
 * Usage:
 *   @Get()
 *   getMyClasses(@CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return request.user;
  },
);
