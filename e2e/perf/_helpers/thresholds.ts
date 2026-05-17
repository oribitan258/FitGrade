/**
 * SLA thresholds for FitGrade performance specs.
 *
 * Two lanes: THRESHOLDS_1X (default) and THRESHOLDS_4X (Chromebook sim).
 * Read PERF_CPU env to pick the active lane via `getThresholds()`.
 *
 * Statistical methods (per metric):
 *   INP        → p75 across interactions, median across 3 runs
 *   LCP        → max within run (monotonic), median across 3 runs
 *   CLS        → final session value, median across 3 runs
 *   Dropped    → frame count sum within measurement window, median across 3 runs
 *   Longtask   → total blocking time = sum of (duration - 50) for tasks > 50 ms
 */

export interface PerfThreshold {
  /** Hard fail — CI goes red */
  fail: number;
  /** Soft warn — PR comment, no red */
  warn: number;
}

export interface SpecThresholds {
  /** INP p75 in ms */
  inpP75?: PerfThreshold;
  /** LCP in ms */
  lcp?: PerfThreshold;
  /** CLS (unitless, × 100 for human readability) */
  cls?: PerfThreshold;
  /** Dropped frame count within measurement window */
  droppedFrames?: PerfThreshold;
  /** Total Blocking Time in ms */
  tbt?: PerfThreshold;
  /** Longest single longtask in ms */
  maxLongtask?: PerfThreshold;
}

export interface Thresholds {
  'live-tap': SpecThresholds;
  'attendance-toggle': SpecThresholds;
  'manual-save': SpecThresholds;
  'modal-open': SpecThresholds;
  'dashboard-lcp': SpecThresholds;
  'live-page-lcp': SpecThresholds;
  'cls-route': SpecThresholds;
  'grade-matrix-scroll': SpecThresholds;
  'semester-switch': SpecThresholds;
  'sidebar-mount': SpecThresholds;
  'splash-overlay': SpecThresholds;
}

export const THRESHOLDS_1X: Thresholds = {
  'live-tap':           { inpP75:       { warn: 120,  fail: 150  } },
  'attendance-toggle':  { inpP75:       { warn: 120,  fail: 150  } },
  'manual-save':        { inpP75:       { warn: 180,  fail: 220  } },
  'modal-open':         { inpP75:       { warn: 200,  fail: 250  } },
  'dashboard-lcp':      { lcp:          { warn: 2400, fail: 2800 } },
  'live-page-lcp':      { lcp:          { warn: 1800, fail: 2200 } },
  'cls-route':          { cls:          { warn: 8,    fail: 10   } },
  'grade-matrix-scroll':{ droppedFrames:{ warn: 10,   fail: 15   } },
  'semester-switch':    { droppedFrames:{ warn: 5,    fail: 8    } },
  'sidebar-mount':      { tbt:          { warn: 300,  fail: 400  } },
  'splash-overlay':     { maxLongtask:  { warn: 150,  fail: 200  } },
};

export const THRESHOLDS_4X: Thresholds = {
  'live-tap':           { inpP75:       { warn: 250,  fail: 300  } },
  'attendance-toggle':  { inpP75:       { warn: 250,  fail: 300  } },
  'manual-save':        { inpP75:       { warn: 350,  fail: 400  } },
  'modal-open':         { inpP75:       { warn: 400,  fail: 450  } },
  'dashboard-lcp':      { lcp:          { warn: 4500, fail: 5000 } },
  'live-page-lcp':      { lcp:          { warn: 3500, fail: 4000 } },
  'cls-route':          { cls:          { warn: 8,    fail: 10   } },
  'grade-matrix-scroll':{ droppedFrames:{ warn: 20,   fail: 30   } },
  'semester-switch':    { droppedFrames:{ warn: 10,   fail: 15   } },
  'sidebar-mount':      { tbt:          { warn: 600,  fail: 800  } },
  'splash-overlay':     { maxLongtask:  { warn: 300,  fail: 400  } },
};

export function getThresholds(): Thresholds {
  return process.env['PERF_CPU'] === '4' ? THRESHOLDS_4X : THRESHOLDS_1X;
}

export type SpecKey = keyof Thresholds;
