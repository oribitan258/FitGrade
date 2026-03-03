/**
 * Grade color hex values — shared between the web Tailwind config
 * (tailwind.config.ts `grade.*` tokens) and the mobile StyleSheet.
 *
 * Keeping them here prevents the colors from drifting apart between apps.
 * The web Tailwind config should import these values directly.
 */
export const GRADE_COLORS = {
  excellent: '#16a34a', // מצטיין  ≥ 90
  good:      '#2563eb', // טוב מאוד / טוב  ≥ 60
  pass:      '#d97706', // עובר  ≥ 55
  fail:      '#dc2626', // נכשל  < 55
} as const;

export type GradeColorKey = keyof typeof GRADE_COLORS;
