/**
 * @fitgrade/types — shared TypeScript utilities consumed by all three apps.
 *
 * Grade utilities:
 *   - getHebrewGradeLabel(score) — maps 0–100 Int → Hebrew grade string
 *   - getGradeColorKey(score)    — maps 0–100 Int → Tailwind color key
 *   - GRADE_COLORS               — hex color values for each grade tier
 *
 * API client:
 *   - ApiError — typed Error subclass thrown by api-client fetch wrappers
 *
 * Shared schemas & types (Zod + inferred TS types + API response interfaces):
 *   - createClassSchema / CreateClassInput
 *   - createStudentSchema / CreateStudentInput
 *   - ClassData / StudentData — API response shapes
 *   - Semester / Gender       — string literal types mirroring Prisma enums
 */

export { getHebrewGradeLabel, getGradeColorKey } from './grade-labels';
export { GRADE_COLORS } from './grade-colors';
export type { GradeColorKey } from './grade-colors';
export { ApiError } from './api-error';
export {
  createClassSchema,
  createStudentSchema,
  createEventSchema,
} from './schemas';
export type {
  Semester,
  Gender,
  ClassGenderType,
  TestCategory,
  ClassData,
  TestTypeData,
  StudentData,
  CreateClassInput,
  CreateStudentInput,
  ClassDetails,
  TestSummary,
  ProgressPoint,
  GradeDistribution,
  StudentGrade,
  StudentHistoryPoint,
  StudentTestHistory,
  TalmidautRecord,
  FinalGrade,
  StudentProfile,
  LiveStudentResult,
  SessionStudent,
  SessionDetail,
  DashboardStats,
  DashboardClassStat,
  RecentSession,
  MissingResultItem,
  BelowNormItem,
  TopStudentItem,
  TopAchievementItem,
  TopStudentPerClassItem,
  EventData,
  CreateEventInput,
  ReportRow,
  ReportTestBreakdown,
  ReportTestResult,
  ReportAttendance,
  StudentReport,
} from './schemas';
export type {
  CopilotSSEEventType,
  CopilotSSEEvent,
  AttendancePreviewRow,
  AttendancePendingPreview,
  ExercisePlanPendingPreview,
  TestResultPendingPreview,
  PendingActionPreview,
  CopilotPageContext,
  CopilotChatRequest,
  CopilotMessageRole,
  CopilotMessage,
  CopilotPanelState,
  CopilotPanelTab,
  AiActionLogItem,
  AiActionLogDetail,
} from './copilot';
