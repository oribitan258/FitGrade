/**
 * Internal types used within the auth module.
 * Not exported as HTTP DTOs — used for service/repository boundaries.
 */

/** Data extracted from a Google OAuth profile to upsert a teacher. */
export interface GoogleTeacherProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/** Teacher record returned after findOrCreate — safe to put into JWT payload. */
export interface TeacherRecord {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/** Full teacher profile returned by GET /auth/me. */
export interface TeacherProfileRecord {
  id: string;
  email: string;
  name: string;
  school: string | null;
  avatarUrl: string | null;
}

/**
 * Data returned from findStudentForLogin — includes passwordHash for
 * bcrypt.compare. Never leaves the auth module.
 */
export interface StudentLoginRecord {
  studentId: string;
  classId: string;
  passwordHash: string;
}

/** Access + refresh token pair issued after successful authentication. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
