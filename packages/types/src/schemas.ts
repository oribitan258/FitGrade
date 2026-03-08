import { z } from 'zod';

// ─── Enum types (mirror Prisma enums, no Prisma import needed) ─────────────

export type Semester = 'A' | 'B';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

// ─── API response shapes ───────────────────────────────────────────────────

/** Mirrors ClassResponseDto returned by GET /classes and GET /classes/:id */
export interface ClassData {
  id: string;
  name: string;
  academicYear: string;
  semester: Semester;
  joinCode: string;
  joinCodeExpiresAt: string | null;
  studentCount: number;
  createdAt: string;
}

/** Mirrors StudentResponseDto returned by GET /classes/:classId/students */
export interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  gender: Gender;
  dateOfBirth: string;
  createdAt: string;
}

// ─── Form validation schemas ───────────────────────────────────────────────

/**
 * Validates the body sent to POST /classes.
 * academicYear must be in "YYYY-YYYY" format (e.g. "2024-2025").
 */
export const createClassSchema = z.object({
  name: z.string().min(1, 'שם הכיתה חובה'),
  academicYear: z.string().regex(
    /^\d{4}-\d{4}$/,
    'פורמט שנת לימודים לא תקין — לדוגמה: 2024-2025',
  ),
  semester: z.enum(['A', 'B'], { required_error: 'יש לבחור סמסטר' }),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;

/**
 * Validates the body sent to POST /classes/:classId/students.
 * dateOfBirth must be a valid ISO 8601 date string.
 * password minimum 8 characters (hashed server-side by bcrypt).
 */
export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'שם פרטי חובה'),
  lastName: z.string().min(1, 'שם משפחה חובה'),
  dateOfBirth: z
    .string()
    .min(1, 'תאריך לידה חובה')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'תאריך לידה לא תקין' }),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { required_error: 'יש לבחור מין' }),
  studentCode: z
    .string()
    .min(2, 'קוד תלמיד חייב להכיל לפחות 2 תווים')
    .max(10, 'קוד תלמיד חייב להכיל לכל היותר 10 תווים'),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

// ─── Class details ─────────────────────────────────────────────────────────

/** One data point on the per-test progress chart — one entry per session. */
export interface ProgressPoint {
  /** Hebrew month label, e.g. "אוק'" */
  month: string;
  /** Average effectiveGrade for this session (0–100). */
  classAvg: number;
}

export interface GradeDistribution {
  excellent: number;  // avg ≥ 90
  good: number;       // avg 75–89
  pass: number;       // avg 60–74
  fail: number;       // avg < 60
}

export interface StudentGrade {
  studentId: string;
  /** gradeOverride ?? calculatedGrade, averaged across sessions of this test type. */
  effectiveGrade: number;
}

export interface TestSummary {
  testTypeId: string;
  nameHe: string;
  unit: string | null;
  /** One entry per conducted session, sorted by date. */
  progressData: ProgressPoint[];
  distribution: GradeDistribution;
  /** One entry per student. */
  studentGrades: StudentGrade[];
}

/** Full response of GET /classes/:id/details */
export interface ClassDetails {
  attendancePct: number;
  testSummaries: TestSummary[];
}

// ─── Student profile ───────────────────────────────────────────────────────

/** One data point in a student's personal test score history. */
export interface StudentHistoryPoint {
  /** Hebrew month label, e.g. "אוק'" */
  month: string;
  /** Effective grade (gradeOverride ?? calculatedGrade) for this session (0–100). */
  grade: number;
}

/** Per-test history for one student, returned by GET /classes/:classId/students/:studentId/profile */
export interface StudentTestHistory {
  testTypeId: string;
  nameHe: string;
  unit: string | null;
  /** Effective grade from the most recent session (0–100). */
  latestGrade: number;
  /** All sessions for this test type, oldest first. */
  history: StudentHistoryPoint[];
}

/** Full response of GET /classes/:classId/students/:studentId/profile */
export interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  /** ISO 8601 date string. */
  dateOfBirth: string;
  gender: Gender;
  studentCode: string;
  /** Percentage of PRESENT attendance records (0–100). */
  attendancePct: number;
  /** Last ≤6 attendance values in chronological order: 100 = present, 0 = absent/late/excused. */
  attendanceTrend: number[];
  /** Average of latestGrade across all test types (0 if no results). */
  overallAvg: number;
  testHistories: StudentTestHistory[];
}

// ─── Live session ──────────────────────────────────────────────────────────

/** One student's recorded result inside an active session. */
export interface LiveStudentResult {
  resultId: string;
  studentId: string;
  /** Raw measurement (seconds for TIME, reps for REPS, etc.) */
  rawValue: number;
  /** Grade 0–100 auto-calculated by the backend GradingService. */
  calculatedGrade: number;
  gradeOverride: number | null;
  /** ISO 8601 date string. */
  recordedAt: string;
}

/** Minimal student shape returned inside SessionDetail (no PII beyond name). */
export interface SessionStudent {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
}

/** Full response of GET /sessions/:sessionId — powers the live-session page. */
export interface SessionDetail {
  id: string;
  classId: string;
  testTypeId: string;
  testNameHe: string;
  testUnit: string | null;
  /** 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL' */
  testInputType: string;
  /** ISO 8601 date string. */
  conductedAt: string;
  isStopwatch: boolean;
  startedAt: string | null;
  completedAt: string | null;
  /** All enrolled students, ordered alphabetically by last name. */
  students: SessionStudent[];
  /** Results submitted so far, oldest first. */
  results: LiveStudentResult[];
}

// ─── Dashboard stats ───────────────────────────────────────────────────────

/** Per-class aggregate stats returned by GET /dashboard/stats */
export interface DashboardClassStat {
  classId: string;
  /** Average calculatedGrade across all results in this class (0 if no results). */
  fitnessAvg: number;
  /** Percentage of PRESENT attendance records (0–100). */
  attendancePct: number;
  /** Students whose average grade is below the PASS threshold (57). */
  belowNormCount: number;
}

/** Summary of a recently conducted test session. */
export interface RecentSession {
  sessionId: string;
  classId: string;
  className: string;
  testNameHe: string;
  /** ISO 8601 date string. */
  conductedAt: string;
}

/** Full response of GET /dashboard/stats */
export interface DashboardStats {
  /** Average calculatedGrade across all teacher classes (0 if no results). */
  overallFitnessAvg: number;
  /** Percentage of PRESENT records across all classes. */
  overallAttendancePct: number;
  /** Students with average grade below PASS threshold (57) across all classes. */
  totalBelowNormCount: number;
  /** Total enrolled students across all classes. */
  totalStudents: number;
  /** Results not yet submitted: expected (sessions × enrollments) minus actual results. */
  pendingResultsCount: number;
  classStats: DashboardClassStat[];
  /** Up to 5 most recent test sessions, newest first. */
  recentSessions: RecentSession[];
}
