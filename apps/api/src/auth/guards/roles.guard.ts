import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import type { Request } from 'express';

/**
 * Global role-based access guard.
 *
 * Registered as the second APP_GUARD in AppModule (after JwtAuthGuard).
 * When a route or controller is decorated with @Roles(...), this guard
 * verifies that the authenticated user's role is in the allowed list.
 *
 * Routes decorated with @Public() are skipped entirely — JwtAuthGuard
 * already handles those (e.g., the Copilot SSE stream endpoint).
 *
 * If no @Roles() decorator is present, the guard passes through — access
 * is controlled solely by JwtAuthGuard (authentication only, no role check).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() routes bypass all auth checks including role checks.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<
      Array<JwtPayload['role']>
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // No @Roles() decorator — no role restriction on this route.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('אין הרשאה לבצע פעולה זו');
    }

    return true;
  }
}
