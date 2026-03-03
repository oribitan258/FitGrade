/**
 * @fitgrade/types — shared TypeScript utilities consumed by all three apps.
 *
 * Current exports:
 *   - getHebrewGradeLabel(score) — maps 0–100 Int → Hebrew grade string
 *   - getGradeColorKey(score)    — maps 0–100 Int → Tailwind color key
 *   - GRADE_COLORS               — hex color values for each grade tier
 *   - ApiError                   — typed Error subclass thrown by api.ts
 *
 * Future exports (added as each feature phase is implemented):
 *   - Shared Zod schemas (CreateClassDto, CreateStudentDto, etc.)
 *   - Shared TypeScript interfaces (JwtPayload, etc.)
 */

export { getHebrewGradeLabel, getGradeColorKey } from './grade-labels';
export { GRADE_COLORS } from './grade-colors';
export type { GradeColorKey } from './grade-colors';
export { ApiError } from './api-error';
