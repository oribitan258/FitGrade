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
  /** false until the teacher finishes the welcome tour + setup form. */
  isOnboardingComplete: boolean;
  /** Test type IDs preferred for boys/MALE classes. */
  defaultMaleTestIds: string[];
  /** Test type IDs preferred for girls/FEMALE classes. */
  defaultFemaleTestIds: string[];
}

/**
 * Data returned from findStudentForNationalIdLogin.
 * Includes passwordHash for optional password verification.
 * null = student was created without a password (falls back to passwordless).
 */
export interface StudentLoginRecord {
  studentId: string;
  classId: string;
  passwordHash: string | null;
}

/** Access + refresh token pair issued after successful authentication. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
