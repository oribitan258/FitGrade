/**
 * Shape of the JWT payload issued by AuthService and verified by JwtStrategy.
 *
 * `sub` is the canonical user/student identifier (matches NestJS Passport convention).
 * The `role` field drives RolesGuard decisions across all controllers.
 */
export interface JwtPayload {
  /** userId for TEACHER; studentId for STUDENT */
  sub: string;
  role: 'TEACHER' | 'STUDENT';
  /** Present only in STUDENT tokens — scopes access to a single class */
  classId?: string;
  /** Standard JWT fields (populated by Passport after verification) */
  iat?: number;
  exp?: number;
}
