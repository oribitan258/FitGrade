/**
 * @fitgrade/types — shared TypeScript utilities consumed by all three apps.
 *
 * Current exports:
 *   - getHebrewGradeLabel(score) — maps 0–100 Int → Hebrew grade string
 *   - getGradeColorKey(score)    — maps 0–100 Int → Tailwind color key
 *
 * Future exports (added as each feature phase is implemented):
 *   - Shared Zod schemas (CreateClassDto, CreateStudentDto, etc.)
 *   - Shared TypeScript interfaces (JwtPayload, ApiError, etc.)
 */

export { getHebrewGradeLabel, getGradeColorKey } from './grade-labels';
