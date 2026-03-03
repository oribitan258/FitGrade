import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * Global JWT authentication guard.
 *
 * Registered as APP_GUARD in AppModule so it runs on every request.
 * Routes decorated with @Public() are allowed through without a token.
 * All other routes require a valid Bearer token in the Authorization header.
 *
 * On invalid/missing token: throws 401 UnauthorizedException.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Called by Passport after canActivate passes.
   * Overridden to throw a typed Hebrew-safe UnauthorizedException
   * instead of the default generic Passport error.
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
  ): TUser {
    if (err !== null || user === false) {
      throw new UnauthorizedException('נדרשת כניסה למערכת');
    }
    return user;
  }
}
