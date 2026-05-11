/**
 * FitGrade — Ministry of Education PE Norms Configuration
 *
 * Single source of truth for all 16 fitness test norm data.
 * Uses school grade levels (1–12) instead of age ranges.
 *
 * Scoring thresholds (s100 → s50):
 *   TIME tests (lower=better):    s100 < s90 < s80 < s70 < s60 < s50
 *   REPS/GENERAL (higher=better): s100 > s90 > s80 > s70 > s60 > s50
 *
 * Data completeness: all secondary tests (grades 7–12) have per-grade individual
 * norm entries. Grouped entries for elementary tests remain unchanged.
 * Grades 11–12 use linear extrapolation from the 9→10 grade delta.
 * run3000 extended to grades 7–8 by backward extrapolation from grades 9–10.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreThresholds {
  s100: number;
  s90:  number;
  s80:  number;
  s70:  number;
  s60:  number;
  s50:  number;
}

export interface GradeLevelNorms {
  /** Israeli school grade numbers that share this norm data. */
  grades:   number[];
  byGender: Partial<Record<'MALE' | 'FEMALE', ScoreThresholds>>;
}

export interface TestNormConfig {
  testKey:        string;
  nameHe:         string;
  descriptionHe?: string;
  inputType:      'TIME' | 'REPS' | 'GENERAL';
  unit:           string;
  higherIsBetter: boolean;
  /** Display metadata only — drives "recommended" badge. Never used to filter. */
  minGrade:       number;
  maxGrade:       number;
  category:       'ENDURANCE' | 'STRENGTH' | 'SPEED_AGILITY' | 'FLEXIBILITY';
  gradeLevels:    GradeLevelNorms[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Derives 6 score thresholds from the 2-anchor linear formula
 * (target100 = raw at score 100, target55 = raw at score 55).
 */
function lin6(t100: number, t55: number): ScoreThresholds {
  const d = (t55 - t100) / 45;
  return {
    s100: +t100.toFixed(4),
    s90:  +(t100 + d * 10).toFixed(4),
    s80:  +(t100 + d * 20).toFixed(4),
    s70:  +(t100 + d * 30).toFixed(4),
    s60:  +(t100 + d * 40).toFixed(4),
    s50:  +(t100 + d * 50).toFixed(4),
  };
}

// ─── Norm Configuration ───────────────────────────────────────────────────────

export const NORM_CONFIG: TestNormConfig[] = [

  // ── ריצת 60 מטר (TIME: seconds, lower=better) ────────────────────────────
  {
    testKey: 'sprint60', nameHe: 'ריצת 60 מטר',
    descriptionHe: 'ריצת מהירות 60 מטר',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 5, maxGrade: 12, category: 'SPEED_AGILITY',
    gradeLevels: [
      { grades: [5, 6],     byGender: { MALE: lin6( 9.0, 12.0), FEMALE: lin6(10.0, 13.5) } },
      { grades: [7],        byGender: { MALE: lin6( 8.6, 11.5), FEMALE: lin6( 9.6, 13.2) } },
      { grades: [8],        byGender: { MALE: lin6( 8.2, 11.0), FEMALE: lin6( 9.2, 12.5) } },
      { grades: [9],        byGender: { MALE: lin6( 7.8, 10.5), FEMALE: lin6( 8.8, 12.0) } },
      { grades: [10],       byGender: { MALE: lin6( 7.6, 10.2), FEMALE: lin6( 9.0, 12.4) } },
      { grades: [11],       byGender: { MALE: lin6( 7.5, 10.0), FEMALE: lin6( 9.0, 12.5) } },
      { grades: [12],       byGender: { MALE: lin6( 7.4,  9.8), FEMALE: lin6( 9.1, 12.7) } },
    ],
  },

  // ── ריצת הלוך ושוב 4×10 מטר (TIME: seconds, lower=better) ────────────────
  // Grades 7–8 previously grouped; grade 8 interpolated as midpoint(7-group, 9).
  // Grades 10–12 previously grouped; grades 11–12 extrapolated via delta(9→10).
  {
    testKey: 'shuttle4x10', nameHe: 'ריצת הלוך ושוב 4×10 מטר',
    descriptionHe: 'מבחן זריזות — ריצת הלוך ושוב 4 פעמים 10 מטר',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 1, maxGrade: 12, category: 'SPEED_AGILITY',
    gradeLevels: [
      { grades: [1, 2],  byGender: { MALE: lin6(13.5, 18.0), FEMALE: lin6(14.5, 19.5) } },
      { grades: [3, 4],  byGender: { MALE: lin6(12.5, 16.5), FEMALE: lin6(13.5, 17.5) } },
      { grades: [5, 6],  byGender: { MALE: lin6(11.5, 14.5), FEMALE: lin6(12.0, 15.5) } },
      { grades: [7],     byGender: { MALE: lin6(10.5, 13.5), FEMALE: lin6(11.5, 14.5) } },
      { grades: [8],     byGender: { MALE: lin6(10.25, 13.25), FEMALE: lin6(11.25, 14.25) } },
      { grades: [9],     byGender: { MALE: lin6(10.0, 13.0), FEMALE: lin6(11.0, 14.0) } },
      { grades: [10],    byGender: { MALE: lin6( 9.8, 12.5), FEMALE: lin6(10.8, 13.8) } },
      { grades: [11],    byGender: { MALE: lin6( 9.6, 12.0), FEMALE: lin6(10.6, 13.6) } },
      { grades: [12],    byGender: { MALE: lin6( 9.4, 11.5), FEMALE: lin6(10.4, 13.4) } },
    ],
  },

  // ── ריצת 2000 מטר (TIME: seconds, lower=better) ──────────────────────────
  {
    testKey: 'run2000', nameHe: 'ריצת 2000 מטר',
    descriptionHe: 'ריצת סיבולת 2000 מטר — בנים',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 7, maxGrade: 12, category: 'ENDURANCE',
    gradeLevels: [
      { grades: [7],  byGender: { MALE: lin6(530, 760), FEMALE: lin6(640, 880) } },
      { grades: [8],  byGender: { MALE: lin6(495, 720), FEMALE: lin6(600, 840) } },
      { grades: [9],  byGender: { MALE: lin6(460, 680), FEMALE: lin6(540, 780) } },
      { grades: [10], byGender: { MALE: lin6(440, 665), FEMALE: lin6(522, 762) } },
      { grades: [11], byGender: { MALE: lin6(428, 660), FEMALE: lin6(513, 754) } },
      { grades: [12], byGender: { MALE: lin6(415, 655), FEMALE: lin6(505, 747) } },
    ],
  },

  // ── ריצת 1500 מטר (TIME: seconds, lower=better) ──────────────────────────
  // Grades 7–8 previously grouped; grade 8 interpolated as midpoint(7-group, 9).
  // Grades 10–12 previously grouped; grades 11–12 extrapolated via delta(9→10) = (−20, −30)s.
  {
    testKey: 'run1500', nameHe: 'ריצת 1500 מטר',
    descriptionHe: 'ריצת סיבולת 1500 מטר — בנות',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 7, maxGrade: 12, category: 'ENDURANCE',
    gradeLevels: [
      { grades: [7],  byGender: { MALE: lin6(360, 540), FEMALE: lin6(435, 660) } },
      { grades: [8],  byGender: { MALE: lin6(345, 525), FEMALE: lin6(427.5, 645) } },
      { grades: [9],  byGender: { MALE: lin6(330, 510), FEMALE: lin6(420, 630) } },
      { grades: [10], byGender: { MALE: lin6(310, 480), FEMALE: lin6(400, 600) } },
      { grades: [11], byGender: { MALE: lin6(290, 450), FEMALE: lin6(380, 570) } },
      { grades: [12], byGender: { MALE: lin6(270, 420), FEMALE: lin6(360, 540) } },
    ],
  },

  // ── ריצת 800 מטר (TIME: seconds, lower=better) ───────────────────────────
  {
    testKey: 'run800', nameHe: 'ריצת 800 מטר',
    descriptionHe: 'ריצת סיבולת 800 מטר — בנות וגילאי ז\'–י"ב',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 7, maxGrade: 12, category: 'ENDURANCE',
    gradeLevels: [
      { grades: [7],  byGender: { MALE: lin6(180, 285), FEMALE: lin6(200, 315) } },
      { grades: [8],  byGender: { MALE: lin6(175, 280), FEMALE: lin6(195, 310) } },
      { grades: [9],  byGender: { MALE: lin6(170, 275), FEMALE: lin6(190, 305) } },
      { grades: [10], byGender: { MALE: lin6(165, 270), FEMALE: lin6(187, 302) } },
      { grades: [11], byGender: { MALE: lin6(162, 267), FEMALE: lin6(184, 299) } },
      { grades: [12], byGender: { MALE: lin6(158, 263), FEMALE: lin6(182, 297) } },
    ],
  },

  // ── ריצת 3000 מטר (TIME: seconds, lower=better) ──────────────────────────
  // Extended from grades 9–12 to 7–12. Grades 7–8 back-extrapolated using
  // delta(9→10) = (+30, +30)s per grade step.
  {
    testKey: 'run3000', nameHe: 'ריצת 3000 מטר',
    descriptionHe: 'ריצת סיבולת 3000 מטר — בנים ז\'–י"ב',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 7, maxGrade: 12, category: 'ENDURANCE',
    gradeLevels: [
      { grades: [7],  byGender: { MALE: lin6( 900, 1260), FEMALE: lin6(1020, 1440) } },
      { grades: [8],  byGender: { MALE: lin6( 870, 1230), FEMALE: lin6( 990, 1410) } },
      { grades: [9],  byGender: { MALE: lin6( 840, 1200), FEMALE: lin6( 960, 1380) } },
      { grades: [10], byGender: { MALE: lin6( 810, 1170), FEMALE: lin6( 930, 1350) } },
      { grades: [11], byGender: { MALE: lin6( 780, 1140), FEMALE: lin6( 900, 1320) } },
      { grades: [12], byGender: { MALE: lin6( 750, 1110), FEMALE: lin6( 870, 1290) } },
    ],
  },

  // ── ריצת 1000 מטר (TIME: seconds, lower=better, elementary) ──────────────
  {
    testKey: 'run1000', nameHe: 'ריצת 1000 מטר',
    descriptionHe: "ריצת סיבולת 1000 מטר — יסודי ה'–ו'",
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 5, maxGrade: 6, category: 'ENDURANCE',
    gradeLevels: [
      { grades: [5, 6], byGender: { MALE: lin6(200, 330), FEMALE: lin6(230, 360) } },
    ],
  },

  // ── מבחן ביפ (GENERAL: level, higher=better) ─────────────────────────────
  // Grades 7–8 previously grouped; grade 8 interpolated as midpoint(7-group, 9).
  // Grades 10–12 previously grouped; grades 11–12 extrapolated via delta(9→10):
  //   MALE: +0.5/step (capped; full delta +1.0 produces unrealistic level 15 for grade 12).
  //   FEMALE: +0.5/step.
  {
    testKey: 'beepTest', nameHe: 'מבחן ביפ',
    descriptionHe: 'מבחן ביפ — רמת כושר אירובי',
    inputType: 'GENERAL', unit: 'רמה', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'ENDURANCE',
    gradeLevels: [
      { grades: [5, 6], byGender: { MALE: lin6( 9.0, 5.0), FEMALE: lin6( 7.0, 3.5) } },
      { grades: [7],    byGender: { MALE: lin6(11.0, 6.0), FEMALE: lin6( 9.0, 5.0) } },
      { grades: [8],    byGender: { MALE: lin6(11.5, 6.5), FEMALE: lin6( 9.5, 5.25) } },
      { grades: [9],    byGender: { MALE: lin6(12.0, 7.0), FEMALE: lin6(10.0, 5.5) } },
      { grades: [10],   byGender: { MALE: lin6(13.0, 7.5), FEMALE: lin6(10.5, 6.0) } },
      { grades: [11],   byGender: { MALE: lin6(13.5, 8.0), FEMALE: lin6(11.0, 6.5) } },
      { grades: [12],   byGender: { MALE: lin6(14.0, 8.5), FEMALE: lin6(11.5, 7.0) } },
    ],
  },

  // ── כפיפות בטן בדקה (REPS: higher=better) ────────────────────────────────
  {
    testKey: 'situps', nameHe: 'כפיפות בטן בדקה',
    descriptionHe: 'כפיפות בטן בשכיבה, דקה אחת',
    inputType: 'REPS', unit: 'חזרות', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    gradeLevels: [
      { grades: [5, 6], byGender: { MALE: lin6(40, 22), FEMALE: lin6(38, 20) } },
      { grades: [7],    byGender: { MALE: lin6(42, 24), FEMALE: lin6(38, 22) } },
      { grades: [8],    byGender: { MALE: lin6(45, 26), FEMALE: lin6(42, 24) } },
      { grades: [9],    byGender: { MALE: lin6(50, 30), FEMALE: lin6(45, 26) } },
      { grades: [10],   byGender: { MALE: lin6(52, 31), FEMALE: lin6(46, 27) } },
      { grades: [11],   byGender: { MALE: lin6(54, 32), FEMALE: lin6(47, 27) } },
      { grades: [12],   byGender: { MALE: lin6(56, 33), FEMALE: lin6(48, 28) } },
    ],
  },

  // ── שכיבות סמיכה (REPS: higher=better) ───────────────────────────────────
  {
    testKey: 'pushUps', nameHe: 'שכיבות סמיכה',
    descriptionHe: 'שכיבות סמיכה בניסיון אחד',
    inputType: 'REPS', unit: 'חזרות', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    gradeLevels: [
      { grades: [5, 6], byGender: { MALE: lin6(25, 12), FEMALE: lin6(15,  6) } },
      { grades: [7],    byGender: { MALE: lin6(30, 14), FEMALE: lin6(16,  7) } },
      { grades: [8],    byGender: { MALE: lin6(35, 17), FEMALE: lin6(20,  8) } },
      { grades: [9],    byGender: { MALE: lin6(42, 21), FEMALE: lin6(23,  9) } },
      { grades: [10],   byGender: { MALE: lin6(45, 22), FEMALE: lin6(24, 10) } },
      { grades: [11],   byGender: { MALE: lin6(47, 23), FEMALE: lin6(25, 10) } },
      { grades: [12],   byGender: { MALE: lin6(50, 25), FEMALE: lin6(26, 11) } },
    ],
  },

  // ── מתח (REPS: higher=better) ────────────────────────────────────────────
  {
    testKey: 'pullUps', nameHe: 'מתח',
    descriptionHe: 'מתח — בנים; תלייה סטטית — בנות',
    inputType: 'REPS', unit: 'חזרות', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    gradeLevels: [
      { grades: [5, 6], byGender: { MALE: lin6( 8, 2), FEMALE: lin6( 4, 1) } },
      { grades: [7],    byGender: { MALE: lin6(10, 3), FEMALE: lin6( 5, 1) } },
      { grades: [8],    byGender: { MALE: lin6(12, 4), FEMALE: lin6( 6, 2) } },
      { grades: [9],    byGender: { MALE: lin6(14, 5), FEMALE: lin6( 7, 2) } },
      { grades: [10],   byGender: { MALE: lin6(15, 5), FEMALE: lin6( 7, 3) } },
      { grades: [11],   byGender: { MALE: lin6(16, 6), FEMALE: lin6( 8, 3) } },
      { grades: [12],   byGender: { MALE: lin6(17, 6), FEMALE: lin6( 9, 3) } },
    ],
  },

  // ── תלייה סטטית (GENERAL: seconds, higher=better) ────────────────────────
  // Grades 7–8 previously grouped; grade 8 interpolated as midpoint(7-group, 9).
  // Grades 10–12 previously grouped; grades 11–12 extrapolated via delta(9→10):
  //   MALE: +10/step (t100), +5/step (t55).  FEMALE: +5/step (t100), +3/step (t55).
  {
    testKey: 'hangTime', nameHe: 'תלייה סטטית',
    descriptionHe: 'תלייה סטטית בידיים — בנות בעיקר',
    inputType: 'GENERAL', unit: 'שניות', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    gradeLevels: [
      { grades: [5, 6], byGender: { MALE: lin6(40, 10), FEMALE: lin6(35,  8) } },
      { grades: [7],    byGender: { MALE: lin6(55, 15), FEMALE: lin6(45, 12) } },
      { grades: [8],    byGender: { MALE: lin6(60, 17.5), FEMALE: lin6(50, 13.5) } },
      { grades: [9],    byGender: { MALE: lin6(65, 20), FEMALE: lin6(55, 15) } },
      { grades: [10],   byGender: { MALE: lin6(75, 25), FEMALE: lin6(60, 18) } },
      { grades: [11],   byGender: { MALE: lin6(85, 30), FEMALE: lin6(65, 21) } },
      { grades: [12],   byGender: { MALE: lin6(95, 35), FEMALE: lin6(70, 24) } },
    ],
  },

  // ── קפיצה לרוחק מהמקום (GENERAL: cm, higher=better) ─────────────────────
  // Grades 7–8 previously grouped; grade 8 interpolated as midpoint(7-group, 9).
  // Grades 10–12 previously grouped; grades 11–12 extrapolated via delta(9→10)
  //   capped at 5% of grade-10 anchor per step.
  //   MALE: delta = min(15, 5%×225=11.25) → 11 cm/step.  t55 delta = 10 → 10 cm/step.
  //   FEMALE: delta = 7 cm/step (under cap).  t55 = 3 cm/step.
  {
    testKey: 'standingLongJump', nameHe: 'קפיצה לרוחק מהמקום',
    descriptionHe: 'קפיצה לרוחק ממצב עמידה',
    inputType: 'GENERAL', unit: 'ס"מ', higherIsBetter: true,
    minGrade: 1, maxGrade: 12, category: 'SPEED_AGILITY',
    gradeLevels: [
      { grades: [1, 2],  byGender: { MALE: lin6(115,  70), FEMALE: lin6(105,  62) } },
      { grades: [3, 4],  byGender: { MALE: lin6(145,  95), FEMALE: lin6(130,  82) } },
      { grades: [5, 6],  byGender: { MALE: lin6(170, 125), FEMALE: lin6(155, 110) } },
      { grades: [7],     byGender: { MALE: lin6(190, 140), FEMALE: lin6(165, 120) } },
      { grades: [8],     byGender: { MALE: lin6(200, 146), FEMALE: lin6(172, 124) } },
      { grades: [9],     byGender: { MALE: lin6(210, 152), FEMALE: lin6(178, 127) } },
      { grades: [10],    byGender: { MALE: lin6(225, 162), FEMALE: lin6(185, 130) } },
      { grades: [11],    byGender: { MALE: lin6(236, 172), FEMALE: lin6(192, 133) } },
      { grades: [12],    byGender: { MALE: lin6(247, 182), FEMALE: lin6(199, 136) } },
    ],
  },

  // ── זריקת כדור כוח (GENERAL: meters, higher=better) ─────────────────────
  // Grades 7–8 previously grouped; grade 8 interpolated as midpoint(7-group, 9).
  // Grades 10–12 previously grouped; grades 11–12 extrapolated via +1.0/step (t100), +0.5/step (t55).
  {
    testKey: 'powerBall', nameHe: 'זריקת כדור כוח',
    descriptionHe: 'זריקת כדור תרגיל (2 ק"ג) מעל הראש לפנים',
    inputType: 'GENERAL', unit: 'מטר', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    gradeLevels: [
      { grades: [5, 6], byGender: { MALE: lin6( 6.5, 3.5), FEMALE: lin6( 5.0, 2.5) } },
      { grades: [7],    byGender: { MALE: lin6( 8.5, 4.5), FEMALE: lin6( 6.0, 3.0) } },
      { grades: [8],    byGender: { MALE: lin6( 9.25, 5.0), FEMALE: lin6( 6.5, 3.25) } },
      { grades: [9],    byGender: { MALE: lin6(10.0, 5.5), FEMALE: lin6( 7.0, 3.5) } },
      { grades: [10],   byGender: { MALE: lin6(11.5, 6.5), FEMALE: lin6( 7.5, 4.0) } },
      { grades: [11],   byGender: { MALE: lin6(12.5, 7.0), FEMALE: lin6( 8.0, 4.5) } },
      { grades: [12],   byGender: { MALE: lin6(13.5, 7.5), FEMALE: lin6( 8.5, 5.0) } },
    ],
  },

  // ── כפיפת גו לפנים — גמישות (GENERAL: cm, higher=better) ────────────────
  // Grades 7–8 previously grouped; grade 8 interpolated as midpoint(7-group, 9).
  // Grades 10–12 previously grouped; grades 11–12 extrapolated via delta(9→10):
  //   MALE: +3/step (t100), +2/step (t55).  FEMALE: +2/step (both).
  {
    testKey: 'flexibility', nameHe: "כפיפת גו לפנים — גמישות",
    descriptionHe: "כפיפת גו לפנים — מבחן סיטנד אנד ריץ'",
    inputType: 'GENERAL', unit: 'ס"מ', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'FLEXIBILITY',
    gradeLevels: [
      { grades: [5, 6], byGender: { MALE: lin6(22,  5), FEMALE: lin6(30, 12) } },
      { grades: [7],    byGender: { MALE: lin6(20,  3), FEMALE: lin6(33, 14) } },
      { grades: [8],    byGender: { MALE: lin6(21,  3.5), FEMALE: lin6(34.5, 15) } },
      { grades: [9],    byGender: { MALE: lin6(22,  4), FEMALE: lin6(36, 16) } },
      { grades: [10],   byGender: { MALE: lin6(25,  6), FEMALE: lin6(38, 18) } },
      { grades: [11],   byGender: { MALE: lin6(28,  8), FEMALE: lin6(40, 20) } },
      { grades: [12],   byGender: { MALE: lin6(31, 10), FEMALE: lin6(42, 22) } },
    ],
  },

  // ── ריצת 300 מטר (grades 1–2) ────────────────────────────────────────────
  {
    testKey: 'run300', nameHe: 'ריצת 300 מטר',
    descriptionHe: "ריצת סיבולת 300 מטר — כיתות א'–ב'",
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 1, maxGrade: 2, category: 'ENDURANCE',
    gradeLevels: [
      {
        grades: [1, 2],
        byGender: {
          MALE:   { s100:  62, s90:  70, s80:  78, s70:  86, s60:  96, s50: 108 },
          FEMALE: { s100:  68, s90:  77, s80:  86, s70:  96, s60: 108, s50: 120 },
        },
      },
    ],
  },

  // ── ריצת 600 מטר (grades 3–4) ────────────────────────────────────────────
  {
    testKey: 'run600', nameHe: 'ריצת 600 מטר',
    descriptionHe: "ריצת סיבולת 600 מטר — כיתות ג'–ד'",
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 3, maxGrade: 4, category: 'ENDURANCE',
    gradeLevels: [
      {
        grades: [3, 4],
        byGender: {
          MALE:   { s100: 130, s90: 148, s80: 166, s70: 188, s60: 210, s50: 235 },
          FEMALE: { s100: 145, s90: 165, s80: 185, s70: 208, s60: 233, s50: 260 },
        },
      },
    ],
  },

  // ── כפיפות בטן 30 שניות (grades 1–4) ─────────────────────────────────────
  {
    testKey: 'situps30', nameHe: 'כפיפות בטן 30 שניות',
    descriptionHe: "כפיפות בטן בשכיבה, 30 שניות — כיתות א'–ד'",
    inputType: 'REPS', unit: 'חזרות', higherIsBetter: true,
    minGrade: 1, maxGrade: 4, category: 'STRENGTH',
    gradeLevels: [
      {
        grades: [1, 2],
        byGender: {
          MALE:   { s100: 18, s90: 15, s80: 13, s70: 11, s60:  9, s50: 7 },
          FEMALE: { s100: 16, s90: 13, s80: 11, s70:  9, s60:  7, s50: 5 },
        },
      },
      {
        grades: [3, 4],
        byGender: {
          MALE:   { s100: 22, s90: 19, s80: 16, s70: 14, s60: 11, s50: 9 },
          FEMALE: { s100: 20, s90: 17, s80: 14, s70: 12, s60:  9, s50: 7 },
        },
      },
    ],
  },
];

// ─── Lookup helper ────────────────────────────────────────────────────────────

/**
 * Returns the ScoreThresholds for a given test/gender/gradeLevel combination.
 * Used by the seeder to compute raw values for seeded test results.
 * Returns undefined if no norm data exists for the combination.
 */
export function findThresholds(
  testKey: string,
  gender: 'MALE' | 'FEMALE',
  gradeLevel: number,
): ScoreThresholds | undefined {
  const config = NORM_CONFIG.find((c) => c.testKey === testKey);
  if (!config) return undefined;
  const group = config.gradeLevels.find((g) => g.grades.includes(gradeLevel));
  if (!group) return undefined;
  return group.byGender[gender];
}
