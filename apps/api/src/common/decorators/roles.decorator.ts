import { SetMetadata } from '@nestjs/common';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export const ROLES_KEY = 'roles';

/**
 * Declares which roles are permitted to access a route or controller.
 * Consumed by RolesGuard, which is registered as a global APP_GUARD.
 *
 * @example
 * @Roles('TEACHER')
 * @Controller('classes')
 * export class ClassesController { ... }
 */
export const Roles = (
  ...roles: Array<JwtPayload['role']>
): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
