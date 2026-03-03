import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by JwtAuthGuard to detect public routes.
 * Exported so the guard can reference it without a circular import.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route handler or controller as publicly accessible.
 * JwtAuthGuard skips JWT validation for any handler decorated with @Public().
 *
 * Apply to all auth endpoints (login, callback, refresh, logout) and the
 * health check endpoint. All other routes require a valid Bearer token.
 *
 * @example
 * @Public()
 * @Get('google')
 * googleLogin() { ... }
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
