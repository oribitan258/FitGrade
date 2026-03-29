/**
 * FitGrade — Ministry of Education PE Norms Configuration
 *
 * Single source of truth for all 16 fitness test norm data.
 * Replaces the inline NORM_SPECS array in seed.ts.
 *
 * Scoring thresholds (s100 → s50):
 *   TIME tests (lower=better):   s100 < s90 < s80 < s70 < s60 < s50
 *   REPS/GENERAL (higher=better): s100 > s90 > s80 > s70 > s60 > s50
 *
 * For the 13 existing tests, thresholds are derived from the old 2-anchor
 * linear formula via lin6(target100, target55) — producing bit-for-bit
 * identical NormTable bands to the previous generateBands() function.
 *
 * For the 3 new elementary tests (run300, run600, situps30), thresholds
 * are sourced directly from Ministry of Education guidelines.
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

export interface AgeGroupNorms {
  minAge:   number;
  maxAge:   number;
  /** Gender keys present are the ones with norm data for this age group. */
  byGender: Partial<Record<'MALE' | 'FEMALE', ScoreThresholds>>;
}

export interface TestNormConfig {
  testKey:        string;
  nameHe:         string;
  descriptionHe?: string;
  /** Prisma FitnessInputType value — cast to enum in seeder. */
  inputType:      'TIME' | 'REPS' | 'GENERAL';
  unit:           string;
  higherIsBetter: boolean;
  /** Display metadata only — drives "recommended" badge. Never used to filter. */
  minGrade:       number;
  maxGrade:       number;
  /** Prisma TestCategory value — cast to enum in seeder. */
  category:       'ENDURANCE' | 'STRENGTH' | 'SPEED_AGILITY' | 'FLEXIBILITY';
  ageGroups:      AgeGroupNorms[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Derives 6 score thresholds from the 2-anchor linear formula used in the
 * original seeder (target100 = raw at score 100, target55 = raw at score 55).
 *
 * The resulting piecewise interpolation produces norm bands that are
 * numerically identical to the previous generateBands(target100, target55).
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
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6( 9.0, 12.0), FEMALE: lin6(10.0, 13.5) } },  // ה'–ו'
      { minAge: 12, maxAge: 13, byGender: { MALE: lin6( 8.6, 11.5), FEMALE: lin6( 9.6, 13.2) } },  // ז'
      { minAge: 13, maxAge: 14, byGender: { MALE: lin6( 8.2, 11.0), FEMALE: lin6( 9.2, 12.5) } },  // ח'
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6( 7.8, 10.5), FEMALE: lin6( 8.8, 12.0) } },  // ט'
      { minAge: 15, maxAge: 16, byGender: { MALE: lin6( 7.6, 10.2), FEMALE: lin6( 9.0, 12.4) } },  // י'
      { minAge: 16, maxAge: 17, byGender: { MALE: lin6( 7.5, 10.0), FEMALE: lin6( 9.0, 12.5) } },  // י"א
      { minAge: 17, maxAge: 18, byGender: { MALE: lin6( 7.4,  9.8), FEMALE: lin6( 9.1, 12.7) } },  // י"ב
    ],
  },

  // ── ריצת הלוך ושוב 4×10 מטר (TIME: seconds, lower=better) ────────────────
  {
    testKey: 'shuttle4x10', nameHe: 'ריצת הלוך ושוב 4×10 מטר',
    descriptionHe: 'מבחן זריזות — ריצת הלוך ושוב 4 פעמים 10 מטר',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 1, maxGrade: 12, category: 'SPEED_AGILITY',
    ageGroups: [
      { minAge:  6, maxAge:  8, byGender: { MALE: lin6(13.5, 18.0), FEMALE: lin6(14.5, 19.5) } },  // א'–ב'
      { minAge:  8, maxAge: 10, byGender: { MALE: lin6(12.5, 16.5), FEMALE: lin6(13.5, 17.5) } },  // ג'–ד'
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6(11.5, 14.5), FEMALE: lin6(12.0, 15.5) } },  // ה'–ו'
      { minAge: 12, maxAge: 14, byGender: { MALE: lin6(10.5, 13.5), FEMALE: lin6(11.5, 14.5) } },
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(10.0, 13.0), FEMALE: lin6(11.0, 14.0) } },
      { minAge: 15, maxAge: 18, byGender: { MALE: lin6( 9.8, 12.5), FEMALE: lin6(10.8, 13.8) } },
    ],
  },

  // ── ריצת 2000 מטר (TIME: seconds, lower=better) ──────────────────────────
  {
    testKey: 'run2000', nameHe: 'ריצת 2000 מטר',
    descriptionHe: 'ריצת סיבולת 2000 מטר — בנים',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 7, maxGrade: 12, category: 'ENDURANCE',
    ageGroups: [
      { minAge: 12, maxAge: 13, byGender: { MALE: lin6(530, 760), FEMALE: lin6(640, 880) } },  // ז'
      { minAge: 13, maxAge: 14, byGender: { MALE: lin6(495, 720), FEMALE: lin6(600, 840) } },  // ח'
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(460, 680), FEMALE: lin6(540, 780) } },  // ט'
      { minAge: 15, maxAge: 16, byGender: { MALE: lin6(440, 665), FEMALE: lin6(522, 762) } },  // י'
      { minAge: 16, maxAge: 17, byGender: { MALE: lin6(428, 660), FEMALE: lin6(513, 754) } },  // י"א
      { minAge: 17, maxAge: 18, byGender: { MALE: lin6(415, 655), FEMALE: lin6(505, 747) } },  // י"ב
    ],
  },

  // ── ריצת 1500 מטר (TIME: seconds, lower=better) ──────────────────────────
  {
    testKey: 'run1500', nameHe: 'ריצת 1500 מטר',
    descriptionHe: 'ריצת סיבולת 1500 מטר — בנות',
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 7, maxGrade: 12, category: 'ENDURANCE',
    ageGroups: [
      { minAge: 12, maxAge: 14, byGender: { MALE: lin6(360, 540), FEMALE: lin6(435, 660) } },
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(330, 510), FEMALE: lin6(420, 630) } },
      { minAge: 15, maxAge: 18, byGender: { MALE: lin6(310, 480), FEMALE: lin6(400, 600) } },
    ],
  },

  // ── ריצת 1000 מטר (TIME: seconds, lower=better, elementary) ──────────────
  {
    testKey: 'run1000', nameHe: 'ריצת 1000 מטר',
    descriptionHe: "ריצת סיבולת 1000 מטר — יסודי ה'–ו'",
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 5, maxGrade: 6, category: 'ENDURANCE',
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6(200, 330), FEMALE: lin6(230, 360) } },
    ],
  },

  // ── מבחן ביפ (GENERAL: level, higher=better) ─────────────────────────────
  {
    testKey: 'beepTest', nameHe: 'מבחן ביפ',
    descriptionHe: 'מבחן ביפ — רמת כושר אירובי',
    inputType: 'GENERAL', unit: 'רמה', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'ENDURANCE',
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6( 9.0, 5.0), FEMALE: lin6( 7.0, 3.5) } },
      { minAge: 12, maxAge: 14, byGender: { MALE: lin6(11.0, 6.0), FEMALE: lin6( 9.0, 5.0) } },
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(12.0, 7.0), FEMALE: lin6(10.0, 5.5) } },
      { minAge: 15, maxAge: 18, byGender: { MALE: lin6(13.0, 7.5), FEMALE: lin6(10.5, 6.0) } },
    ],
  },

  // ── כפיפות בטן בדקה (REPS: higher=better) ────────────────────────────────
  {
    testKey: 'situps', nameHe: 'כפיפות בטן בדקה',
    descriptionHe: 'כפיפות בטן בשכיבה, דקה אחת',
    inputType: 'REPS', unit: 'חזרות', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6(40, 22), FEMALE: lin6(38, 20) } },  // ה'–ו'
      { minAge: 12, maxAge: 13, byGender: { MALE: lin6(42, 24), FEMALE: lin6(38, 22) } },  // ז'
      { minAge: 13, maxAge: 14, byGender: { MALE: lin6(45, 26), FEMALE: lin6(42, 24) } },  // ח'
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(50, 30), FEMALE: lin6(45, 26) } },  // ט'
      { minAge: 15, maxAge: 16, byGender: { MALE: lin6(52, 31), FEMALE: lin6(46, 27) } },  // י'
      { minAge: 16, maxAge: 17, byGender: { MALE: lin6(54, 32), FEMALE: lin6(47, 27) } },  // י"א
      { minAge: 17, maxAge: 18, byGender: { MALE: lin6(56, 33), FEMALE: lin6(48, 28) } },  // י"ב
    ],
  },

  // ── שכיבות סמיכה (REPS: higher=better) ───────────────────────────────────
  {
    testKey: 'pushUps', nameHe: 'שכיבות סמיכה',
    descriptionHe: 'שכיבות סמיכה בניסיון אחד',
    inputType: 'REPS', unit: 'חזרות', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6(25, 12), FEMALE: lin6(15,  6) } },  // ה'–ו'
      { minAge: 12, maxAge: 13, byGender: { MALE: lin6(30, 14), FEMALE: lin6(16,  7) } },  // ז'
      { minAge: 13, maxAge: 14, byGender: { MALE: lin6(35, 17), FEMALE: lin6(20,  8) } },  // ח'
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(42, 21), FEMALE: lin6(23,  9) } },  // ט'
      { minAge: 15, maxAge: 16, byGender: { MALE: lin6(45, 22), FEMALE: lin6(24, 10) } },  // י'
      { minAge: 16, maxAge: 17, byGender: { MALE: lin6(47, 23), FEMALE: lin6(25, 10) } },  // י"א
      { minAge: 17, maxAge: 18, byGender: { MALE: lin6(50, 25), FEMALE: lin6(26, 11) } },  // י"ב
    ],
  },

  // ── מתח (REPS: higher=better) ────────────────────────────────────────────
  {
    testKey: 'pullUps', nameHe: 'מתח',
    descriptionHe: 'מתח — בנים; תלייה סטטית — בנות',
    inputType: 'REPS', unit: 'חזרות', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6( 8, 2), FEMALE: lin6( 4, 1) } },  // ה'–ו'
      { minAge: 12, maxAge: 13, byGender: { MALE: lin6(10, 3), FEMALE: lin6( 5, 1) } },  // ז'
      { minAge: 13, maxAge: 14, byGender: { MALE: lin6(12, 4), FEMALE: lin6( 6, 2) } },  // ח'
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(14, 5), FEMALE: lin6( 7, 2) } },  // ט'
      { minAge: 15, maxAge: 16, byGender: { MALE: lin6(15, 5), FEMALE: lin6( 7, 3) } },  // י'
      { minAge: 16, maxAge: 17, byGender: { MALE: lin6(16, 6), FEMALE: lin6( 8, 3) } },  // י"א
      { minAge: 17, maxAge: 18, byGender: { MALE: lin6(17, 6), FEMALE: lin6( 9, 3) } },  // י"ב
    ],
  },

  // ── תלייה סטטית (GENERAL: seconds, higher=better) ────────────────────────
  {
    testKey: 'hangTime', nameHe: 'תלייה סטטית',
    descriptionHe: 'תלייה סטטית בידיים — בנות בעיקר',
    inputType: 'GENERAL', unit: 'שניות', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6(40, 10), FEMALE: lin6(35,  8) } },
      { minAge: 12, maxAge: 14, byGender: { MALE: lin6(55, 15), FEMALE: lin6(45, 12) } },
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(65, 20), FEMALE: lin6(55, 15) } },
      { minAge: 15, maxAge: 18, byGender: { MALE: lin6(75, 25), FEMALE: lin6(60, 18) } },
    ],
  },

  // ── קפיצה לרוחק מהמקום (GENERAL: cm, higher=better) ─────────────────────
  {
    testKey: 'standingLongJump', nameHe: 'קפיצה לרוחק מהמקום',
    descriptionHe: 'קפיצה לרוחק ממצב עמידה',
    inputType: 'GENERAL', unit: 'ס"מ', higherIsBetter: true,
    minGrade: 1, maxGrade: 12, category: 'SPEED_AGILITY',
    ageGroups: [
      { minAge:  6, maxAge:  8, byGender: { MALE: lin6(115,  70), FEMALE: lin6(105,  62) } },  // א'–ב'
      { minAge:  8, maxAge: 10, byGender: { MALE: lin6(145,  95), FEMALE: lin6(130,  82) } },  // ג'–ד'
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6(170, 125), FEMALE: lin6(155, 110) } },  // ה'–ו'
      { minAge: 12, maxAge: 14, byGender: { MALE: lin6(190, 140), FEMALE: lin6(165, 120) } },
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(210, 152), FEMALE: lin6(178, 127) } },
      { minAge: 15, maxAge: 18, byGender: { MALE: lin6(225, 162), FEMALE: lin6(185, 130) } },
    ],
  },

  // ── זריקת כדור כוח (GENERAL: meters, higher=better) ─────────────────────
  {
    testKey: 'powerBall', nameHe: 'זריקת כדור כוח',
    descriptionHe: 'זריקת כדור תרגיל (2 ק"ג) מעל הראש לפנים',
    inputType: 'GENERAL', unit: 'מטר', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'STRENGTH',
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6( 6.5, 3.5), FEMALE: lin6( 5.0, 2.5) } },
      { minAge: 12, maxAge: 14, byGender: { MALE: lin6( 8.5, 4.5), FEMALE: lin6( 6.0, 3.0) } },
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(10.0, 5.5), FEMALE: lin6( 7.0, 3.5) } },
      { minAge: 15, maxAge: 18, byGender: { MALE: lin6(11.5, 6.5), FEMALE: lin6( 7.5, 4.0) } },
    ],
  },

  // ── כפיפת גו לפנים — גמישות (GENERAL: cm, higher=better) ────────────────
  {
    testKey: 'flexibility', nameHe: "כפיפת גו לפנים — גמישות",
    descriptionHe: "כפיפת גו לפנים — מבחן סיטנד אנד ריץ'",
    inputType: 'GENERAL', unit: 'ס"מ', higherIsBetter: true,
    minGrade: 5, maxGrade: 12, category: 'FLEXIBILITY',
    ageGroups: [
      { minAge: 10, maxAge: 12, byGender: { MALE: lin6(22,  5), FEMALE: lin6(30, 12) } },
      { minAge: 12, maxAge: 14, byGender: { MALE: lin6(20,  3), FEMALE: lin6(33, 14) } },
      { minAge: 14, maxAge: 15, byGender: { MALE: lin6(22,  4), FEMALE: lin6(36, 16) } },
      { minAge: 15, maxAge: 18, byGender: { MALE: lin6(25,  6), FEMALE: lin6(38, 18) } },
    ],
  },

  // ── ריצת 300 מטר (NEW — grades 1–2) ─────────────────────────────────────
  {
    testKey: 'run300', nameHe: 'ריצת 300 מטר',
    descriptionHe: "ריצת סיבולת 300 מטר — כיתות א'–ב'",
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 1, maxGrade: 2, category: 'ENDURANCE',
    ageGroups: [
      {
        minAge: 6, maxAge: 8,
        byGender: {
          MALE:   { s100:  62, s90:  70, s80:  78, s70:  86, s60:  96, s50: 108 },
          FEMALE: { s100:  68, s90:  77, s80:  86, s70:  96, s60: 108, s50: 120 },
        },
      },
    ],
  },

  // ── ריצת 600 מטר (NEW — grades 3–4) ─────────────────────────────────────
  {
    testKey: 'run600', nameHe: 'ריצת 600 מטר',
    descriptionHe: "ריצת סיבולת 600 מטר — כיתות ג'–ד'",
    inputType: 'TIME', unit: 'שניות', higherIsBetter: false,
    minGrade: 3, maxGrade: 4, category: 'ENDURANCE',
    ageGroups: [
      {
        minAge: 8, maxAge: 10,
        byGender: {
          MALE:   { s100: 130, s90: 148, s80: 166, s70: 188, s60: 210, s50: 235 },
          FEMALE: { s100: 145, s90: 165, s80: 185, s70: 208, s60: 233, s50: 260 },
        },
      },
    ],
  },

  // ── כפיפות בטן 30 שניות (NEW — grades 1–4) ───────────────────────────────
  {
    testKey: 'situps30', nameHe: 'כפיפות בטן 30 שניות',
    descriptionHe: "כפיפות בטן בשכיבה, 30 שניות — כיתות א'–ד'",
    inputType: 'REPS', unit: 'חזרות', higherIsBetter: true,
    minGrade: 1, maxGrade: 4, category: 'STRENGTH',
    ageGroups: [
      {
        minAge: 6, maxAge: 8,
        byGender: {
          MALE:   { s100: 18, s90: 15, s80: 13, s70: 11, s60:  9, s50: 7 },
          FEMALE: { s100: 16, s90: 13, s80: 11, s70:  9, s60:  7, s50: 5 },
        },
      },
      {
        minAge: 8, maxAge: 10,
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
 * Returns the ScoreThresholds for a given test/gender/age combination.
 * Used by the seeder to compute raw values for seeded test results.
 * Returns undefined if no norm data exists for the combination.
 */
export function findThresholds(
  testKey: string,
  gender: 'MALE' | 'FEMALE',
  age: number,
): ScoreThresholds | undefined {
  const config = NORM_CONFIG.find((c) => c.testKey === testKey);
  if (!config) return undefined;
  const group = config.ageGroups.find((g) => g.minAge <= age && age < g.maxAge);
  if (!group) return undefined;
  return group.byGender[gender];
}
