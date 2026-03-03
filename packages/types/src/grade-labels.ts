/**
 * Grade thresholds for the FitGrade system.
 *
 * Grades are stored in the database as integers (0–100).
 * These constants define the cut-offs for each Hebrew label.
 * They are the single source of truth — never duplicate these in UI code.
 */
const GRADE_EXCELLENT = 90; // מצטיין
const GRADE_VERY_GOOD = 75; // טוב מאוד
const GRADE_GOOD = 60;      // טוב
const GRADE_PASS = 55;      // עובר
// Below GRADE_PASS        → נכשל

/**
 * Maps a numeric grade (0–100 integer, as stored in the DB) to its
 * Hebrew categorical label for display in the UI.
 *
 * This function is the ONLY place grade numbers are turned into Hebrew
 * strings. Import it from @fitgrade/types everywhere — never hard-code
 * Hebrew grade strings in component files.
 *
 * @param score - Integer 0–100 as returned by GradingService
 * @returns Hebrew grade label string
 *
 * @example
 * getHebrewGradeLabel(95) // "מצטיין"
 * getHebrewGradeLabel(80) // "טוב מאוד"
 * getHebrewGradeLabel(65) // "טוב"
 * getHebrewGradeLabel(57) // "עובר"
 * getHebrewGradeLabel(40) // "נכשל"
 */
export function getHebrewGradeLabel(score: number): string {
  if (score >= GRADE_EXCELLENT) return 'מצטיין';
  if (score >= GRADE_VERY_GOOD) return 'טוב מאוד';
  if (score >= GRADE_GOOD)      return 'טוב';
  if (score >= GRADE_PASS)      return 'עובר';
  return 'נכשל';
}

/**
 * Returns the Tailwind CSS color token (from tailwind.config.ts `grade.*`)
 * that corresponds to the grade label, for use in class names or inline styles.
 *
 * @example
 * getGradeColorKey(95) // "excellent"  → use text-grade-excellent / bg-grade-excellent
 * getGradeColorKey(40) // "fail"       → use text-grade-fail / bg-grade-fail
 */
export function getGradeColorKey(
  score: number,
): 'excellent' | 'good' | 'pass' | 'fail' {
  if (score >= GRADE_EXCELLENT) return 'excellent';
  if (score >= GRADE_GOOD)      return 'good';
  if (score >= GRADE_PASS)      return 'pass';
  return 'fail';
}
