/**
 * Shared UI constants for the mobile field app.
 * Teachers use this app outdoors — all touch targets must respect these minimums.
 */

/** Minimum touch target size in pixels (per mobile.md rules). */
export const MIN_TOUCH_TARGET = 56;

/**
 * Student name buttons in stopwatch mode must be at least this tall.
 * Full-width buttons reduce miss-taps in outdoor conditions.
 */
export const STOPWATCH_ROW_HEIGHT = 72;

/** Bottom navigation tabs minimum height. */
export const TAB_BAR_HEIGHT = 64;

/** Font size minimums */
export const FONT_SIZE_BODY = 16;
export const FONT_SIZE_BUTTON = 18;
export const FONT_SIZE_STOPWATCH_TIMER = 48;

/** App color palette (mirrors tailwind.config.ts grade.* tokens) */
export const COLORS = {
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  primary: '#1e293b',
  grade: {
    excellent: '#16a34a', // מצטיין
    good: '#2563eb',      // טוב מאוד / טוב
    pass: '#d97706',      // עובר
    fail: '#dc2626',      // נכשל
  },
} as const;
