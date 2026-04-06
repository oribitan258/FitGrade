import { z } from 'zod';

// ─── Enum types (mirror Prisma enums, no Prisma import needed) ─────────────

export type Semester = 'A' | 'B';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type ClassGenderType = 'BOYS' | 'GIRLS' | 'MIXED';
export type TestCategory = 'ENDURANCE' | 'STRENGTH' | 'SPEED_AGILITY' | 'FLEXIBILITY';

// ─── API response shapes ───────────────────────────────────────────────────

/** Mirrors ClassResponseDto returned by GET /classes and GET /classes/:id */
export interface ClassData {
  id: string;
  name: string;
  academicYear: string;
  semester: Semester;
  /** Gender composition of the class: BOYS | GIRLS | MIXED. */
  genderType: ClassGenderType;
  joinCode: string;
  joinCodeExpiresAt: string | null;
  studentCount: number;
  createdAt: string;
  /** School grade level 1–12. null for legacy classes created before this field. */
  gradeLevel: number | null;
  /** Per-class fitness-test weight override. null = use teacher's global default. */
  testWeight: number | null;
  /** Per-class Talmida'ut weight override. null = use teacher's global default. */
  talmidautWeight: number | null;
}

/** Mirrors FitnessTestTypeResponseDto returned by GET /tests/types */
export interface TestTypeData {
  id: string;
  nameHe: string;
  descriptionHe: string | null;
  inputType: 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL';
  unit: string | null;
  isGlobal: boolean;
  higherIsBetter: boolean;
  /** Logical grouping for UI tabs: ENDURANCE | STRENGTH | SPEED_AGILITY | FLEXIBILITY */
  category: TestCategory;
  /** Recommended minimum school grade (1–12). null = no lower bound. Display only. */
  minGrade: number | null;
  /** Recommended maximum school grade (1–12). null = no upper bound. Display only. */
  maxGrade: number | null;
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
  genderType: z.enum(['BOYS', 'GIRLS', 'MIXED']).default('MIXED'),
  /** School grade level 1–12. Optional for backward compatibility with legacy callers. */
  gradeLevel: z.number().int().min(1).max(12).optional(),
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
  /** Raw measurement value from the most recent session (seconds, reps, etc.), or null. */
  rawValue: number | null;
  /**
   * The teacher's explicit override from the most recent session, or null if never set / cleared.
   * null ≠ "no grade" — it means the teacher hasn't touched this cell.
   * Used by the grade matrix to differentiate "auto-calculated" from "teacher-overridden".
   */
  gradeOverride: number | null;
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
  /** Input type: 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL' */
  inputType: string;
  /** Effective grade from the most recent session (0–100). */
  latestGrade: number;
  /** Raw measurement value from the most recent session (seconds, reps, etc.), or null if not available. */
  latestRawValue: number | null;
  /** All sessions for this test type, oldest first. */
  history: StudentHistoryPoint[];
}

/** One talmidaut assessment record returned in StudentProfile. */
export interface TalmidautRecord {
  id: string;
  participation: number;
  uniform: number;
  behavior: number;
  /** Average of participation + uniform + behavior (0–100). */
  compositeScore: number;
  notes: string | null;
  /** ISO 8601 timestamp. */
  recordedAt: string;
}

/** Recommended final grade breakdown returned in StudentProfile. */
export interface FinalGrade {
  /** Weighted average of all test calculatedGrade/gradeOverride values (0–100). */
  fitnessAvg: number;
  /** Average of all talmidaut compositeScore values (0–100). */
  talmidautAvg: number;
  /** Computed final grade: fitnessAvg × testWeight% + talmidautAvg × talmidautWeight% */
  recommendedGrade: number;
  /** Fitness test weight for this class (e.g. 55). */
  testWeight: number;
  /** Talmidaut weight for this class (e.g. 45). */
  talmidautWeight: number;
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
  /** All talmidaut records for this student in this class, newest first. */
  talmidautRecords: TalmidautRecord[];
  /** Recommended final grade breakdown. */
  finalGrade: FinalGrade;
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
  /** Students missing a result for at least one existing session. */
  pendingResultsCount: number;
  classStats: DashboardClassStat[];
  /** Up to 5 most recent test sessions, newest first. */
  recentSessions: RecentSession[];
}

/** One student/session pair missing a test result — GET /dashboard/missing-results */
export interface MissingResultItem {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  sessionId: string;
  testNameHe: string;
  /** ISO 8601 date string of the session. */
  sessionDate: string;
}

/** One test result that fell below the norm threshold — GET /dashboard/below-norm-details */
export interface BelowNormItem {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  testNameHe: string;
  /** The student's calculatedGrade (0–100). */
  score: number;
  /** The norm threshold the student fell below (currently 57). */
  normThreshold: number;
}

// ─── Events ────────────────────────────────────────────────────────────────

/** Mirrors EventResponseDto returned by GET /events and GET /events/upcoming */
export interface EventData {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;  // ISO 8601
  location: string | null;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validates the body sent to POST /events.
 * eventDate must be a valid ISO 8601 date string.
 */
export const createEventSchema = z.object({
  title: z.string().min(1, 'כותרת האירוע חובה'),
  description: z.string().optional(),
  eventDate: z
    .string()
    .min(1, 'תאריך האירוע חובה')
    .refine((v) => !isNaN(Date.parse(v)), { message: 'תאריך לא תקין' }),
  location: z.string().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

// ─── Reports ────────────────────────────────────────────────────────────────

/** Per-test grade breakdown within a ReportRow. */
export interface ReportTestBreakdown {
  testTypeId: string;
  nameHe: string;
  grade: number;
}

/** One student row in the class final-grades report — GET /reports/class/:classId */
export interface ReportRow {
  studentId: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  /** Average of best effective grade per test type (0–100). */
  fitnessAvg: number;
  /** talmidautAvg minus absence penalty, clamped to [0, 100]. */
  conductScore: number;
  /** Effective fitness weight used for this row's grade calculation (0–100 integer). */
  fitnessWeight: number;
  /** Effective conduct weight used for this row's grade calculation (0–100 integer). */
  conductWeight: number;
  /** Recommended grade: fitnessAvg × fitnessWeight% + conductScore × conductWeight%, rounded. */
  recommendedFinalGrade: number;
  /** Teacher's override, or null if not saved yet. */
  teacherFinalGrade: number | null;
  /** Heuristic-suggested Ministry comment. */
  suggestedComment: string;
  /** Teacher's saved verbal comment, or null. */
  verbalComment: string | null;
  /** Count of ABSENT (unexcused) records. */
  unexcusedAbsences: number;
  /** Total attendance records for this student. */
  totalLessons: number;
  testBreakdown: ReportTestBreakdown[];
}

/** Top performing student — GET /dashboard/top-students */
export interface TopStudentItem {
  /** Rank position, starting at 1. */
  rank: number;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  /** Average calculatedGrade across all recorded results (0–100). */
  avgGrade: number;
  /** Number of test results recorded for this student. */
  resultCount: number;
  /** Student gender — used for gender-split MVP sections. */
  gender: Gender;
}

/** Top student per class — GET /dashboard/top-per-class — top 3 per class by average score */
export interface TopStudentPerClassItem {
  /** Rank within the class: 1, 2, or 3. */
  rank: number;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  /** Average calculatedGrade across all recorded results in this class (0–100). */
  avgScore: number;
}

// ─── Student Report ──────────────────────────────────────────────────────────

/** One test-type row in the formal student report. */
export interface ReportTestResult {
  testTypeId: string;
  nameHe: string;
  unit: string | null;
  /** 'TIME' | 'REPS' | 'PASS_FAIL' | 'GENERAL' */
  inputType: string;
  /** ISO 8601 date of the most recent session for this test. */
  conductedAt: string;
  /** Effective grade: gradeOverride ?? calculatedGrade (0–100). */
  grade: number;
  rawValue: number | null;
  /** Class-wide average for this test type in the requested semester (0–100). */
  classAvg: number;
  /** Number of times the student took this test. */
  sessionCount: number;
}

/** Attendance breakdown for the formal student report. */
export interface ReportAttendance {
  total: number;
  present: number;
  absent: number;
  excused: number;
  /** Percentage of present records (0–100). */
  pct: number;
}

/** Full formal student report — GET /classes/:classId/students/:studentId/report */
export interface StudentReport {
  studentId: string;
  firstName: string;
  lastName: string;
  gender: string;
  /** ISO 8601 date string. */
  dateOfBirth: string;
  studentCode: string;
  className: string;
  gradeLevel: number | null;
  /** 'A' | 'B' | null (null = all semesters). */
  semester: string | null;
  /** ISO 8601 timestamp when the report was generated. */
  generatedAt: string;
  /** Test results sorted best-grade first. */
  testResults: ReportTestResult[];
  attendance: ReportAttendance;
  finalGrade: FinalGrade;
}

/** Top individual achievement — GET /dashboard/top-achievements */
export interface TopAchievementItem {
  /** Rank position, starting at 1. */
  rank: number;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  /** Gender composition of the class: BOYS | GIRLS | MIXED. */
  classGenderType: ClassGenderType;
  /** Hebrew name of the specific exam (e.g. "ריצת 2000מ׳"). */
  examName: string;
  /** Unit label for the test type (e.g. "שניות", "מטר") — null for REPS/PASS_FAIL. */
  unit: string | null;
  /** Raw measurement value (seconds for TIME, reps for REPS) — null if not recorded. */
  rawValue: number | null;
  /** The student's calculatedGrade for this result (0–100). */
  score: number;
}
