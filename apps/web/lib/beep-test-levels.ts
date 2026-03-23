/**
 * Standard 20m PACER (Progressive Aerobic Cardiovascular Endurance Run) level data.
 *
 * intervalMs formula: (20m / speed_m_s) * 1000
 *   where speed_m_s = speedKmh / 3.6
 *   simplified: intervalMs = (20 / (speedKmh / 3.6)) * 1000 = 72_000 / speedKmh
 *
 * Source: Canadian 20m Shuttle Run Test / FITNESSGRAM PACER protocol (21 levels).
 */

export interface BeepLevel {
  /** Level number (1–21). */
  level: number;
  /** Number of 20m shuttles in this level. */
  shuttles: number;
  /** Running speed required (km/h). */
  speedKmh: number;
  /** Milliseconds between consecutive beeps at this level's speed. */
  intervalMs: number;
}

/** Pre-computed interval in ms for a given speed. */
function interval(speedKmh: number): number {
  return Math.round((20 / (speedKmh / 3.6)) * 1000);
}

export const BEEP_TEST_LEVELS: readonly BeepLevel[] = [
  { level:  1, shuttles:  7, speedKmh:  8.5, intervalMs: interval( 8.5) },
  { level:  2, shuttles:  8, speedKmh:  9.0, intervalMs: interval( 9.0) },
  { level:  3, shuttles:  8, speedKmh:  9.5, intervalMs: interval( 9.5) },
  { level:  4, shuttles:  9, speedKmh: 10.0, intervalMs: interval(10.0) },
  { level:  5, shuttles:  9, speedKmh: 10.5, intervalMs: interval(10.5) },
  { level:  6, shuttles: 10, speedKmh: 11.0, intervalMs: interval(11.0) },
  { level:  7, shuttles: 10, speedKmh: 11.5, intervalMs: interval(11.5) },
  { level:  8, shuttles: 11, speedKmh: 12.0, intervalMs: interval(12.0) },
  { level:  9, shuttles: 11, speedKmh: 12.5, intervalMs: interval(12.5) },
  { level: 10, shuttles: 11, speedKmh: 13.0, intervalMs: interval(13.0) },
  { level: 11, shuttles: 12, speedKmh: 13.5, intervalMs: interval(13.5) },
  { level: 12, shuttles: 12, speedKmh: 14.0, intervalMs: interval(14.0) },
  { level: 13, shuttles: 13, speedKmh: 14.5, intervalMs: interval(14.5) },
  { level: 14, shuttles: 13, speedKmh: 15.0, intervalMs: interval(15.0) },
  { level: 15, shuttles: 13, speedKmh: 15.5, intervalMs: interval(15.5) },
  { level: 16, shuttles: 14, speedKmh: 16.0, intervalMs: interval(16.0) },
  { level: 17, shuttles: 14, speedKmh: 16.5, intervalMs: interval(16.5) },
  { level: 18, shuttles: 15, speedKmh: 17.0, intervalMs: interval(17.0) },
  { level: 19, shuttles: 15, speedKmh: 17.5, intervalMs: interval(17.5) },
  { level: 20, shuttles: 16, speedKmh: 18.0, intervalMs: interval(18.0) },
  { level: 21, shuttles: 17, speedKmh: 18.5, intervalMs: interval(18.5) },
] as const;

/** Total number of beeps across the full 21-level test. */
export const TOTAL_BEEPS: number = BEEP_TEST_LEVELS.reduce(
  (sum, lvl) => sum + lvl.shuttles,
  0,
);
