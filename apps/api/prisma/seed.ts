/**
 * Prisma seed script — FitGrade full development dataset.
 *
 * Seeds:
 *  - 13 Israeli Ministry of Education FitnessTestTypes (self-contained, no XLSX needed)
 *  - Formula-based NormTable bands (linear interpolation between target_100 and target_55)
 *    Per-grade resolution for sprint60, run2000, pushUps, situps, pullUps (grades ז'–י"ב)
 *  - 1 teacher, 2 classes (grade 10 and grade 7) for cross-age-group coverage
 *  - 15 students per class with authentic Israeli names and varied performance tiers
 *  - Test sessions with formula-consistent raw values and calculatedGrades
 *  - Talmida'ut records (3 monthly assessments per student per class)
 *  - Recommended StudentFinalGrade per student per class
 *  - Attendance records (26 lessons per class, Sep 2025 – Mar 2026)
 *
 * Idempotent: cleans up previous dev data (by teacher email) before re-seeding.
 * Run via: pnpm prisma:seed  (or)  npx prisma db seed
 *
 * Scoring formula:
 *   rawAtScore(s) = target100 + (100 - s) × (target55 - target100) / 45
 *   For TIME (lower=better): target55 > target100
 *   For GENERAL/REPS (higher=better): target100 > target55
 */

import {
  AttendanceStatus,
  FitnessInputType,
  Gender,
  Prisma,
  PrismaClient,
  Semester,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10;

type Tier = 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'PASS' | 'FAIL';

/** Grade awarded per performance tier — consistent with Ministry categories. */
const TIER_GRADE: Record<Tier, number> = {
  EXCELLENT: 95,
  VERY_GOOD: 80,
  GOOD:      65,
  PASS:      57,
  FAIL:      40,
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface StudentDef {
  firstName: string;
  lastName:  string;
  dob:       string;  // ISO date
  gender:    Gender;
  code:      string;
  tier:      Tier;
}

interface TestTypeDef {
  key:            string;
  nameHe:         string;
  descriptionHe?: string;
  inputType:      FitnessInputType;
  unit:           string;
  higherIsBetter: boolean;
}

/** One anchor point defining a performance threshold for a gender × age group. */
interface NormTarget {
  gender:    Gender;
  minAge:    number;
  maxAge:    number;
  target100: number; // raw value that earns score 100 (best performance)
  target55:  number; // raw value that earns score 55  (mediocre)
}

interface NormSpec {
  testKey:   string;
  isTime:    boolean; // true = lower raw value is better (sprints, endurance)
  targets:   NormTarget[];
}

interface NormBandInput {
  gender:   Gender;
  minAge:   number;
  maxAge:   number;
  minValue: string;
  maxValue: string;
  score:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST TYPE CATALOGUE — 13 standard Israeli Ministry PE tests
// ─────────────────────────────────────────────────────────────────────────────

const TEST_TYPES: TestTypeDef[] = [
  { key: 'sprint60',         nameHe: 'ריצת 60 מטר',               descriptionHe: 'ריצת מהירות 60 מטר',                                inputType: FitnessInputType.TIME,    unit: 'שניות',  higherIsBetter: false },
  { key: 'shuttle4x10',      nameHe: 'ריצת הלוך ושוב 4×10 מטר',   descriptionHe: 'מבחן זריזות — ריצת הלוך ושוב 4 פעמים 10 מטר',       inputType: FitnessInputType.TIME,    unit: 'שניות',  higherIsBetter: false },
  { key: 'run2000',          nameHe: 'ריצת 2000 מטר',              descriptionHe: 'ריצת סיבולת 2000 מטר — בנים',                        inputType: FitnessInputType.TIME,    unit: 'שניות',  higherIsBetter: false },
  { key: 'run1500',          nameHe: 'ריצת 1500 מטר',              descriptionHe: 'ריצת סיבולת 1500 מטר — בנות',                        inputType: FitnessInputType.TIME,    unit: 'שניות',  higherIsBetter: false },
  { key: 'run1000',          nameHe: 'ריצת 1000 מטר',              descriptionHe: "ריצת סיבולת 1000 מטר — יסודי ה'–ו'",                 inputType: FitnessInputType.TIME,    unit: 'שניות',  higherIsBetter: false },
  { key: 'beepTest',         nameHe: 'מבחן ביפ',                   descriptionHe: 'מבחן ביפ — רמת כושר אירובי',                         inputType: FitnessInputType.GENERAL, unit: 'רמה',    higherIsBetter: true  },
  { key: 'situps',           nameHe: 'כפיפות בטן בדקה',            descriptionHe: 'כפיפות בטן בשכיבה, דקה אחת',                        inputType: FitnessInputType.REPS,    unit: 'חזרות',  higherIsBetter: true  },
  { key: 'pushUps',          nameHe: 'שכיבות סמיכה',               descriptionHe: 'שכיבות סמיכה בניסיון אחד',                           inputType: FitnessInputType.REPS,    unit: 'חזרות',  higherIsBetter: true  },
  { key: 'pullUps',          nameHe: 'מתח',                        descriptionHe: 'מתח — בנים; תלייה סטטית — בנות',                     inputType: FitnessInputType.REPS,    unit: 'חזרות',  higherIsBetter: true  },
  { key: 'hangTime',         nameHe: 'תלייה סטטית',                descriptionHe: 'תלייה סטטית בידיים — בנות בעיקר',                    inputType: FitnessInputType.GENERAL, unit: 'שניות',  higherIsBetter: true  },
  { key: 'standingLongJump', nameHe: 'קפיצה לרוחק מהמקום',         descriptionHe: 'קפיצה לרוחק ממצב עמידה',                             inputType: FitnessInputType.GENERAL, unit: 'ס"מ',    higherIsBetter: true  },
  { key: 'powerBall',        nameHe: 'זריקת כדור כוח',             descriptionHe: 'זריקת כדור תרגיל (2 ק"ג) מעל הראש לפנים',           inputType: FitnessInputType.GENERAL, unit: 'מטר',    higherIsBetter: true  },
  { key: 'flexibility',      nameHe: "כפיפת גו לפנים — גמישות",   descriptionHe: "כפיפת גו לפנים — מבחן סיטנד אנד ריץ'",              inputType: FitnessInputType.GENERAL, unit: 'ס"מ',    higherIsBetter: true  },
];

// ─────────────────────────────────────────────────────────────────────────────
// NORM TABLE TARGETS (per test × gender × age group)
// Age groups — elementary and per-grade secondary resolution:
//   ה–ו: 10–12  |  ז': 12–13  |  ח': 13–14  |  ט': 14–15  |  י': 15–16  |  י"א: 16–17  |  י"ב: 17–18
// ─────────────────────────────────────────────────────────────────────────────

const NORM_SPECS: NormSpec[] = [
  // ── ריצת 60 מטר (TIME: seconds, lower = better) ──────────────────────────
  {
    testKey: 'sprint60', isTime: true,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100:  9.0, target55: 12.0 },  // ה'–ו'
      { gender: Gender.MALE,   minAge: 12, maxAge: 13, target100:  8.6, target55: 11.5 },  // ז'
      { gender: Gender.MALE,   minAge: 13, maxAge: 14, target100:  8.2, target55: 11.0 },  // ח'
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100:  7.8, target55: 10.5 },  // ט'
      { gender: Gender.MALE,   minAge: 15, maxAge: 16, target100:  7.6, target55: 10.2 },  // י'
      { gender: Gender.MALE,   minAge: 16, maxAge: 17, target100:  7.5, target55: 10.0 },  // י"א
      { gender: Gender.MALE,   minAge: 17, maxAge: 18, target100:  7.4, target55:  9.8 },  // י"ב
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100: 10.0, target55: 13.5 },  // ה'–ו'
      { gender: Gender.FEMALE, minAge: 12, maxAge: 13, target100:  9.6, target55: 13.2 },  // ז'
      { gender: Gender.FEMALE, minAge: 13, maxAge: 14, target100:  9.2, target55: 12.5 },  // ח'
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100:  8.8, target55: 12.0 },  // ט'
      { gender: Gender.FEMALE, minAge: 15, maxAge: 16, target100:  9.0, target55: 12.4 },  // י'
      { gender: Gender.FEMALE, minAge: 16, maxAge: 17, target100:  9.0, target55: 12.5 },  // י"א
      { gender: Gender.FEMALE, minAge: 17, maxAge: 18, target100:  9.1, target55: 12.7 },  // י"ב
    ],
  },
  // ── ריצת הלוך ושוב 4×10 מטר (TIME: seconds, lower = better) ──────────────
  {
    testKey: 'shuttle4x10', isTime: true,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100: 11.5, target55: 14.5 },
      { gender: Gender.MALE,   minAge: 12, maxAge: 14, target100: 10.5, target55: 13.5 },
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 10.0, target55: 13.0 },
      { gender: Gender.MALE,   minAge: 15, maxAge: 18, target100:  9.8, target55: 12.5 },
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100: 12.0, target55: 15.5 },
      { gender: Gender.FEMALE, minAge: 12, maxAge: 14, target100: 11.5, target55: 14.5 },
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 11.0, target55: 14.0 },
      { gender: Gender.FEMALE, minAge: 15, maxAge: 18, target100: 10.8, target55: 13.8 },
    ],
  },
  // ── ריצת 2000 מטר (TIME: seconds, lower = better) ────────────────────────
  {
    testKey: 'run2000', isTime: true,
    targets: [
      { gender: Gender.MALE,   minAge: 12, maxAge: 13, target100: 530, target55: 760 },  // ז'
      { gender: Gender.MALE,   minAge: 13, maxAge: 14, target100: 495, target55: 720 },  // ח'
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 460, target55: 680 },  // ט'
      { gender: Gender.MALE,   minAge: 15, maxAge: 16, target100: 440, target55: 665 },  // י'
      { gender: Gender.MALE,   minAge: 16, maxAge: 17, target100: 428, target55: 660 },  // י"א
      { gender: Gender.MALE,   minAge: 17, maxAge: 18, target100: 415, target55: 655 },  // י"ב
      { gender: Gender.FEMALE, minAge: 12, maxAge: 13, target100: 640, target55: 880 },  // ז'
      { gender: Gender.FEMALE, minAge: 13, maxAge: 14, target100: 600, target55: 840 },  // ח'
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 540, target55: 780 },  // ט'
      { gender: Gender.FEMALE, minAge: 15, maxAge: 16, target100: 522, target55: 762 },  // י'
      { gender: Gender.FEMALE, minAge: 16, maxAge: 17, target100: 513, target55: 754 },  // י"א
      { gender: Gender.FEMALE, minAge: 17, maxAge: 18, target100: 505, target55: 747 },  // י"ב
    ],
  },
  // ── ריצת 1500 מטר (TIME: seconds, lower = better) ────────────────────────
  {
    testKey: 'run1500', isTime: true,
    targets: [
      { gender: Gender.MALE,   minAge: 12, maxAge: 14, target100: 360, target55: 540 },
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 330, target55: 510 },
      { gender: Gender.MALE,   minAge: 15, maxAge: 18, target100: 310, target55: 480 },
      { gender: Gender.FEMALE, minAge: 12, maxAge: 14, target100: 435, target55: 660 },
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 420, target55: 630 },
      { gender: Gender.FEMALE, minAge: 15, maxAge: 18, target100: 400, target55: 600 },
    ],
  },
  // ── ריצת 1000 מטר (TIME: seconds, lower = better, elementary) ─────────────
  {
    testKey: 'run1000', isTime: true,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100: 200, target55: 330 },
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100: 230, target55: 360 },
    ],
  },
  // ── מבחן ביפ (GENERAL: level, higher = better) ───────────────────────────
  {
    testKey: 'beepTest', isTime: false,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100:  9.0, target55: 5.0 },
      { gender: Gender.MALE,   minAge: 12, maxAge: 14, target100: 11.0, target55: 6.0 },
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 12.0, target55: 7.0 },
      { gender: Gender.MALE,   minAge: 15, maxAge: 18, target100: 13.0, target55: 7.5 },
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100:  7.0, target55: 3.5 },
      { gender: Gender.FEMALE, minAge: 12, maxAge: 14, target100:  9.0, target55: 5.0 },
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 10.0, target55: 5.5 },
      { gender: Gender.FEMALE, minAge: 15, maxAge: 18, target100: 10.5, target55: 6.0 },
    ],
  },
  // ── כפיפות בטן בדקה (REPS: higher = better) ──────────────────────────────
  {
    testKey: 'situps', isTime: false,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100: 40, target55: 22 },  // ה'–ו'
      { gender: Gender.MALE,   minAge: 12, maxAge: 13, target100: 42, target55: 24 },  // ז'
      { gender: Gender.MALE,   minAge: 13, maxAge: 14, target100: 45, target55: 26 },  // ח'
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 50, target55: 30 },  // ט'
      { gender: Gender.MALE,   minAge: 15, maxAge: 16, target100: 52, target55: 31 },  // י'
      { gender: Gender.MALE,   minAge: 16, maxAge: 17, target100: 54, target55: 32 },  // י"א
      { gender: Gender.MALE,   minAge: 17, maxAge: 18, target100: 56, target55: 33 },  // י"ב
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100: 38, target55: 20 },  // ה'–ו'
      { gender: Gender.FEMALE, minAge: 12, maxAge: 13, target100: 38, target55: 22 },  // ז'
      { gender: Gender.FEMALE, minAge: 13, maxAge: 14, target100: 42, target55: 24 },  // ח'
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 45, target55: 26 },  // ט'
      { gender: Gender.FEMALE, minAge: 15, maxAge: 16, target100: 46, target55: 27 },  // י'
      { gender: Gender.FEMALE, minAge: 16, maxAge: 17, target100: 47, target55: 27 },  // י"א
      { gender: Gender.FEMALE, minAge: 17, maxAge: 18, target100: 48, target55: 28 },  // י"ב
    ],
  },
  // ── שכיבות סמיכה (REPS: higher = better) ─────────────────────────────────
  {
    testKey: 'pushUps', isTime: false,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100: 25, target55: 12 },  // ה'–ו'
      { gender: Gender.MALE,   minAge: 12, maxAge: 13, target100: 30, target55: 14 },  // ז'
      { gender: Gender.MALE,   minAge: 13, maxAge: 14, target100: 35, target55: 17 },  // ח'
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 42, target55: 21 },  // ט'
      { gender: Gender.MALE,   minAge: 15, maxAge: 16, target100: 45, target55: 22 },  // י'
      { gender: Gender.MALE,   minAge: 16, maxAge: 17, target100: 47, target55: 23 },  // י"א
      { gender: Gender.MALE,   minAge: 17, maxAge: 18, target100: 50, target55: 25 },  // י"ב
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100: 15, target55:  6 },  // ה'–ו'
      { gender: Gender.FEMALE, minAge: 12, maxAge: 13, target100: 16, target55:  7 },  // ז'
      { gender: Gender.FEMALE, minAge: 13, maxAge: 14, target100: 20, target55:  8 },  // ח'
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 23, target55:  9 },  // ט'
      { gender: Gender.FEMALE, minAge: 15, maxAge: 16, target100: 24, target55: 10 },  // י'
      { gender: Gender.FEMALE, minAge: 16, maxAge: 17, target100: 25, target55: 10 },  // י"א
      { gender: Gender.FEMALE, minAge: 17, maxAge: 18, target100: 26, target55: 11 },  // י"ב
    ],
  },
  // ── מתח (REPS: higher = better) ──────────────────────────────────────────
  {
    testKey: 'pullUps', isTime: false,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100:  8, target55: 2 },  // ה'–ו'
      { gender: Gender.MALE,   minAge: 12, maxAge: 13, target100: 10, target55: 3 },  // ז'
      { gender: Gender.MALE,   minAge: 13, maxAge: 14, target100: 12, target55: 4 },  // ח'
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 14, target55: 5 },  // ט'
      { gender: Gender.MALE,   minAge: 15, maxAge: 16, target100: 15, target55: 5 },  // י'
      { gender: Gender.MALE,   minAge: 16, maxAge: 17, target100: 16, target55: 6 },  // י"א
      { gender: Gender.MALE,   minAge: 17, maxAge: 18, target100: 17, target55: 6 },  // י"ב
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100:  4, target55: 1 },  // ה'–ו'
      { gender: Gender.FEMALE, minAge: 12, maxAge: 13, target100:  5, target55: 1 },  // ז'
      { gender: Gender.FEMALE, minAge: 13, maxAge: 14, target100:  6, target55: 2 },  // ח'
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100:  7, target55: 2 },  // ט'
      { gender: Gender.FEMALE, minAge: 15, maxAge: 16, target100:  7, target55: 3 },  // י'
      { gender: Gender.FEMALE, minAge: 16, maxAge: 17, target100:  8, target55: 3 },  // י"א
      { gender: Gender.FEMALE, minAge: 17, maxAge: 18, target100:  9, target55: 3 },  // י"ב
    ],
  },
  // ── תלייה סטטית (GENERAL: seconds, higher = better) ──────────────────────
  {
    testKey: 'hangTime', isTime: false,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100: 40, target55: 10 },
      { gender: Gender.MALE,   minAge: 12, maxAge: 14, target100: 55, target55: 15 },
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 65, target55: 20 },
      { gender: Gender.MALE,   minAge: 15, maxAge: 18, target100: 75, target55: 25 },
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100: 35, target55:  8 },
      { gender: Gender.FEMALE, minAge: 12, maxAge: 14, target100: 45, target55: 12 },
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 55, target55: 15 },
      { gender: Gender.FEMALE, minAge: 15, maxAge: 18, target100: 60, target55: 18 },
    ],
  },
  // ── קפיצה לרוחק מהמקום (GENERAL: cm, higher = better) ───────────────────
  {
    testKey: 'standingLongJump', isTime: false,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100: 170, target55: 125 },
      { gender: Gender.MALE,   minAge: 12, maxAge: 14, target100: 190, target55: 140 },
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 210, target55: 152 },
      { gender: Gender.MALE,   minAge: 15, maxAge: 18, target100: 225, target55: 162 },
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100: 155, target55: 110 },
      { gender: Gender.FEMALE, minAge: 12, maxAge: 14, target100: 165, target55: 120 },
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 178, target55: 127 },
      { gender: Gender.FEMALE, minAge: 15, maxAge: 18, target100: 185, target55: 130 },
    ],
  },
  // ── זריקת כדור כוח (GENERAL: meters, higher = better) ────────────────────
  {
    testKey: 'powerBall', isTime: false,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100:  6.5, target55: 3.5 },
      { gender: Gender.MALE,   minAge: 12, maxAge: 14, target100:  8.5, target55: 4.5 },
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 10.0, target55: 5.5 },
      { gender: Gender.MALE,   minAge: 15, maxAge: 18, target100: 11.5, target55: 6.5 },
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100:  5.0, target55: 2.5 },
      { gender: Gender.FEMALE, minAge: 12, maxAge: 14, target100:  6.0, target55: 3.0 },
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100:  7.0, target55: 3.5 },
      { gender: Gender.FEMALE, minAge: 15, maxAge: 18, target100:  7.5, target55: 4.0 },
    ],
  },
  // ── כפיפת גו לפנים — גמישות (GENERAL: cm, higher = better) ──────────────
  {
    testKey: 'flexibility', isTime: false,
    targets: [
      { gender: Gender.MALE,   minAge: 10, maxAge: 12, target100: 22, target55:  5 },
      { gender: Gender.MALE,   minAge: 12, maxAge: 14, target100: 20, target55:  3 },
      { gender: Gender.MALE,   minAge: 14, maxAge: 15, target100: 22, target55:  4 },
      { gender: Gender.MALE,   minAge: 15, maxAge: 18, target100: 25, target55:  6 },
      { gender: Gender.FEMALE, minAge: 10, maxAge: 12, target100: 30, target55: 12 },
      { gender: Gender.FEMALE, minAge: 12, maxAge: 14, target100: 33, target55: 14 },
      { gender: Gender.FEMALE, minAge: 14, maxAge: 15, target100: 36, target55: 16 },
      { gender: Gender.FEMALE, minAge: 15, maxAge: 18, target100: 38, target55: 18 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FORMULA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the raw value corresponding to a given score, using linear
 * interpolation between target_100 (score 100) and target_55 (score 55).
 *
 * TIME (lower=better): target55 > target100, value increases as score decreases.
 * GENERAL (higher=better): target100 > target55, value decreases as score decreases.
 */
function rawAtScore(score: number, target100: number, target55: number): number {
  return target100 + (100 - score) * (target55 - target100) / 45;
}

/**
 * Returns the raw value a student of the given gender/age should achieve to
 * match their performance tier, based on the formula targets.
 */
function rawForTier(testKey: string, gender: Gender, age: number, tier: Tier): number {
  const spec = NORM_SPECS.find((s) => s.testKey === testKey);
  if (!spec) throw new Error(`No NormSpec for testKey: ${testKey}`);

  const target = spec.targets.find(
    (t) => t.gender === gender && t.minAge <= age && t.maxAge > age,
  );
  if (!target) throw new Error(`No NormTarget for ${testKey}/${gender}/age=${age}`);

  return rawAtScore(TIER_GRADE[tier], target.target100, target.target55);
}

/**
 * Generates NormTable band records for one test/gender/ageGroup combination.
 *
 * NormTable lookup condition: minValue ≤ rawValue < maxValue
 *
 * For TIME (lower=better):
 *   Score 100:  [0, rawAtScore(100)+ε)  — fastest times
 *   Score s:    [rawAtScore(s+1)+ε, rawAtScore(s)+ε)
 *   Score 1:    [rawAtScore(2)+ε, 999999)  — slowest times
 *
 * For GENERAL/REPS (higher=better):
 *   Score 100:  [rawAtScore(100), 999999)  — highest values
 *   Score s:    [rawAtScore(s), rawAtScore(s+1))
 *   Score 1:    [0, rawAtScore(2))  — lowest values
 */
function generateBands(
  target100: number,
  target55:  number,
  isTime:    boolean,
  gender:    Gender,
  minAge:    number,
  maxAge:    number,
): NormBandInput[] {
  /** Small epsilon makes the threshold value itself fall in the intended band. */
  const EPS = 0.0001;
  const bands: NormBandInput[] = [];

  if (isTime) {
    // Score 100: [0, rawAtScore(100)+ε)
    const raw100 = rawAtScore(100, target100, target55);
    bands.push({
      gender, minAge, maxAge, score: 100,
      minValue: '0',
      maxValue: String(+(raw100 + EPS).toFixed(4)),
    });

    // Scores 99 → 2
    for (let s = 99; s >= 2; s--) {
      const lo = rawAtScore(s + 1, target100, target55) + EPS;
      const hi = rawAtScore(s, target100, target55) + EPS;
      bands.push({
        gender, minAge, maxAge, score: s,
        minValue: String(+lo.toFixed(4)),
        maxValue: String(+hi.toFixed(4)),
      });
    }

    // Score 1 catch-all
    const raw2 = rawAtScore(2, target100, target55) + EPS;
    bands.push({
      gender, minAge, maxAge, score: 1,
      minValue: String(+raw2.toFixed(4)),
      maxValue: '999999',
    });
  } else {
    // Score 100: [rawAtScore(100), 999999)
    const raw100 = rawAtScore(100, target100, target55);
    bands.push({
      gender, minAge, maxAge, score: 100,
      minValue: String(+Math.max(0, raw100).toFixed(4)),
      maxValue: '999999',
    });

    // Scores 99 → 2
    for (let s = 99; s >= 2; s--) {
      const lo = rawAtScore(s, target100, target55);
      const hi = rawAtScore(s + 1, target100, target55);
      bands.push({
        gender, minAge, maxAge, score: s,
        minValue: String(+Math.max(0, lo).toFixed(4)),
        maxValue: String(+Math.max(0, hi).toFixed(4)),
      });
    }

    // Score 1 catch-all
    const raw2 = rawAtScore(2, target100, target55);
    bands.push({
      gender, minAge, maxAge, score: 1,
      minValue: '0',
      maxValue: String(+Math.max(0, raw2).toFixed(4)),
    });
  }

  return bands;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ROSTERS
// ─────────────────────────────────────────────────────────────────────────────

/** Grade 10 class (כיתה י' 1) — students born 2008–2009, age ~16 at test time. */
const STUDENTS_GRADE10: StudentDef[] = [
  // Males (8)
  { firstName: 'אביב',   lastName: 'כהן',        dob: '2009-03-15', gender: Gender.MALE,   code: '101',   tier: 'EXCELLENT' },
  { firstName: 'אורן',   lastName: 'גולדשטיין',  dob: '2008-12-12', gender: Gender.MALE,   code: '102',   tier: 'EXCELLENT' },
  { firstName: 'יונתן',  lastName: 'לוי',         dob: '2009-07-22', gender: Gender.MALE,   code: '103',   tier: 'VERY_GOOD' },
  { firstName: 'מתן',    lastName: 'אברהם',       dob: '2008-11-30', gender: Gender.MALE,   code: '104',   tier: 'VERY_GOOD' },
  { firstName: 'נדב',    lastName: 'מזרחי',       dob: '2009-05-10', gender: Gender.MALE,   code: '105',   tier: 'GOOD'      },
  { firstName: 'רון',    lastName: "ברקוביץ'",    dob: '2009-01-18', gender: Gender.MALE,   code: '106',   tier: 'GOOD'      },
  { firstName: 'תלמיד',  lastName: 'בדיקות',      dob: '2008-06-15', gender: Gender.MALE,   code: '12345', tier: 'PASS'      }, // dev student portal login
  { firstName: 'דניאל',  lastName: 'פרידמן',      dob: '2009-02-28', gender: Gender.MALE,   code: '108',   tier: 'FAIL'      },
  // Females (7)
  { firstName: 'שירה',   lastName: 'כץ',          dob: '2009-04-20', gender: Gender.FEMALE, code: '109',   tier: 'EXCELLENT' },
  { firstName: 'מאיה',   lastName: 'דוד',         dob: '2009-08-14', gender: Gender.FEMALE, code: '110',   tier: 'VERY_GOOD' },
  { firstName: 'ליאת',   lastName: 'חיים',        dob: '2008-06-03', gender: Gender.FEMALE, code: '111',   tier: 'VERY_GOOD' },
  { firstName: 'נועה',   lastName: 'פרץ',         dob: '2009-10-25', gender: Gender.FEMALE, code: '112',   tier: 'GOOD'      },
  { firstName: 'יובל',   lastName: 'אשכנזי',      dob: '2009-06-30', gender: Gender.FEMALE, code: '113',   tier: 'GOOD'      },
  { firstName: 'תמר',    lastName: 'גרינברג',     dob: '2008-03-17', gender: Gender.FEMALE, code: '114',   tier: 'PASS'      },
  { firstName: 'ענבל',   lastName: 'שמיר',        dob: '2009-12-08', gender: Gender.FEMALE, code: '115',   tier: 'FAIL'      },
];

/** Grade 7 class (כיתה ז' 2) — students born 2012–2013, age ~12-13 at test time. */
const STUDENTS_GRADE7: StudentDef[] = [
  // Males (7)
  { firstName: 'עמית',   lastName: 'ביטון',       dob: '2012-04-10', gender: Gender.MALE,   code: '201',   tier: 'EXCELLENT' },
  { firstName: 'גל',     lastName: 'שפירא',       dob: '2013-01-05', gender: Gender.MALE,   code: '202',   tier: 'VERY_GOOD' },
  { firstName: 'ליאור',  lastName: 'נחום',        dob: '2012-09-18', gender: Gender.MALE,   code: '203',   tier: 'GOOD'      },
  { firstName: 'רן',     lastName: 'סלע',         dob: '2013-03-22', gender: Gender.MALE,   code: '204',   tier: 'PASS'      },
  { firstName: 'אלון',   lastName: 'מנחם',        dob: '2012-07-14', gender: Gender.MALE,   code: '205',   tier: 'FAIL'      },
  { firstName: 'בן',     lastName: 'הרוש',        dob: '2013-06-30', gender: Gender.MALE,   code: '206',   tier: 'VERY_GOOD' },
  { firstName: 'יואב',   lastName: 'ששון',        dob: '2012-11-08', gender: Gender.MALE,   code: '207',   tier: 'GOOD'      },
  // Females (8)
  { firstName: 'הדר',    lastName: 'בן-דוד',      dob: '2012-05-19', gender: Gender.FEMALE, code: '208',   tier: 'EXCELLENT' },
  { firstName: 'נגה',    lastName: 'אלון',        dob: '2013-02-11', gender: Gender.FEMALE, code: '209',   tier: 'EXCELLENT' },
  { firstName: 'מור',    lastName: 'ישראלי',      dob: '2012-08-25', gender: Gender.FEMALE, code: '210',   tier: 'VERY_GOOD' },
  { firstName: 'שקד',    lastName: 'כהן',         dob: '2013-04-17', gender: Gender.FEMALE, code: '211',   tier: 'GOOD'      },
  { firstName: 'רינת',   lastName: 'סעדון',       dob: '2012-10-03', gender: Gender.FEMALE, code: '212',   tier: 'GOOD'      },
  { firstName: 'עדי',    lastName: 'לוי',         dob: '2013-07-21', gender: Gender.FEMALE, code: '213',   tier: 'PASS'      },
  { firstName: 'יעל',    lastName: 'פינטו',       dob: '2012-12-09', gender: Gender.FEMALE, code: '214',   tier: 'FAIL'      },
  { firstName: 'אורית',  lastName: 'חדד',         dob: '2013-05-28', gender: Gender.FEMALE, code: '215',   tier: 'PASS'      },
];

// ─────────────────────────────────────────────────────────────────────────────
// LESSON DATES — 26 lessons, ~2× per week, Sep 2025 – Mar 2026
// ─────────────────────────────────────────────────────────────────────────────

const LESSON_DATES: Date[] = [
  new Date('2025-09-03'), new Date('2025-09-07'),
  new Date('2025-09-14'), new Date('2025-09-21'),
  new Date('2025-10-01'), new Date('2025-10-08'),
  new Date('2025-10-15'), // sprint60
  new Date('2025-10-22'), new Date('2025-10-29'),
  new Date('2025-11-05'),
  new Date('2025-11-12'), // situps / pushUps
  new Date('2025-11-19'), new Date('2025-11-26'),
  new Date('2025-12-03'),
  new Date('2025-12-10'), // standingLongJump / beepTest
  new Date('2025-12-17'), new Date('2025-12-24'),
  new Date('2026-01-07'),
  new Date('2026-01-14'), // flexibility / situps
  new Date('2026-01-21'), new Date('2026-01-28'),
  new Date('2026-02-04'), new Date('2026-02-11'),
  new Date('2026-02-18'), new Date('2026-02-25'),
  new Date('2026-03-04'),
];

const TOTAL_LESSONS = LESSON_DATES.length; // 26

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ABSENT_INDICES: Record<Tier, number[]> = {
  EXCELLENT: [20],
  VERY_GOOD: [5, 18],
  GOOD:      [3, 11, 22],
  PASS:      [1, 8, 15, 21, 24],
  FAIL:      [2, 5, 9, 13, 16, 19, 22, 25],
};

const LATE_INDICES: Record<Tier, number[]> = {
  EXCELLENT: [],
  VERY_GOOD: [12],
  GOOD:      [7, 19],
  PASS:      [4, 14],
  FAIL:      [4, 10, 23],
};

function getAttendanceStatus(tier: Tier, lessonIdx: number, studentIdx: number): AttendanceStatus {
  const shift  = studentIdx % 5;
  const absent = ABSENT_INDICES[tier].map((i) => (i + shift) % TOTAL_LESSONS);
  const late   = LATE_INDICES[tier].map((i)   => (i + shift) % TOTAL_LESSONS);
  if (absent.includes(lessonIdx)) return AttendanceStatus.ABSENT;
  if (late.includes(lessonIdx))   return AttendanceStatus.LATE;
  return AttendanceStatus.PRESENT;
}

// ─────────────────────────────────────────────────────────────────────────────
// TALMIDA'UT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface TalmidautSnapshot {
  participation: number;
  uniform:       number;
  behavior:      number;
  recordedAt:    Date;
}

function talmidautSnapshots(tier: Tier, studentIdx: number): TalmidautSnapshot[] {
  const BASE: Record<Tier, [number, number, number]> = {
    EXCELLENT: [98, 97, 98],
    VERY_GOOD: [88, 85, 90],
    GOOD:      [75, 70, 78],
    PASS:      [65, 60, 68],
    FAIL:      [45, 40, 50],
  };
  const [p, u, b] = BASE[tier];
  const jitter = (n: number, d: number) => Math.min(100, Math.max(0, n + d));

  return [
    {
      participation: jitter(p, studentIdx % 5),
      uniform:       jitter(u, studentIdx % 4),
      behavior:      jitter(b, studentIdx % 3),
      recordedAt:    new Date('2025-10-31'),
    },
    {
      participation: jitter(p, (studentIdx + 1) % 5),
      uniform:       jitter(u, (studentIdx + 2) % 4),
      behavior:      jitter(b, (studentIdx + 1) % 3),
      recordedAt:    new Date('2025-12-31'),
    },
    {
      participation: jitter(p, (studentIdx + 2) % 5),
      uniform:       jitter(u, (studentIdx + 3) % 4),
      behavior:      jitter(b, (studentIdx + 2) % 3),
      recordedAt:    new Date('2026-02-28'),
    },
  ];
}

function compositeScore(s: TalmidautSnapshot): number {
  return Math.round((s.participation + s.uniform + s.behavior) / 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function cleanupDevData(): Promise<void> {
  console.log('Cleaning up previous dev data...');
  const teacher = await prisma.user.findFirst({
    where: { email: 'teacher@test.com' },
    select: {
      id: true,
      classes: { select: { id: true, enrollments: { select: { studentId: true } } } },
    },
  });
  if (teacher) {
    const studentIds = teacher.classes.flatMap((c) => c.enrollments.map((e) => e.studentId));
    // Cascade deletes classes → sessions → results, attendance, enrollments
    await prisma.class.deleteMany({ where: { teacherId: teacher.id } });
    if (studentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    }
    await prisma.user.delete({ where: { id: teacher.id } });
    console.log(`  Removed teacher, ${teacher.classes.length} class(es), ${studentIds.length} student(s).`);
  }

  // Remove all global test types (cascades to norm tables)
  const { count } = await prisma.fitnessTestType.deleteMany({ where: { isGlobal: true } });
  console.log(`  Removed ${count} global FitnessTestType(s) and all associated NormTable rows.`);
}

async function seedTestTypesAndNorms(): Promise<Map<string, string>> {
  console.log('\nSeeding FitnessTestTypes + NormTables (formula-based)...');
  const testTypeIds = new Map<string, string>();

  for (const def of TEST_TYPES) {
    const spec = NORM_SPECS.find((s) => s.testKey === def.key);
    if (!spec) {
      console.log(`  [SKIP] No NormSpec for: ${def.nameHe}`);
      continue;
    }

    // Build all bands for every configured gender × age group
    const bands: NormBandInput[] = [];
    for (const t of spec.targets) {
      const groupBands = generateBands(
        t.target100, t.target55, spec.isTime,
        t.gender, t.minAge, t.maxAge,
      );
      bands.push(...groupBands);
    }

    const created = await prisma.fitnessTestType.create({
      data: {
        nameHe:         def.nameHe,
        descriptionHe:  def.descriptionHe,
        inputType:      def.inputType,
        unit:           def.unit,
        isGlobal:       true,
        higherIsBetter: def.higherIsBetter,
        normTables: {
          createMany: {
            data: bands.map((b) => ({
              gender:   b.gender,
              minAge:   b.minAge,
              maxAge:   b.maxAge,
              minValue: new Prisma.Decimal(b.minValue),
              maxValue: new Prisma.Decimal(b.maxValue),
              score:    b.score,
            })),
          },
        },
      },
      select: { id: true },
    });

    testTypeIds.set(def.key, created.id);
    console.log(
      `  ✓ ${def.nameHe} — ${bands.length} norm bands (${spec.targets.length} age/gender groups)`,
    );
  }

  return testTypeIds;
}

async function seedClass(opts: {
  name:        string;
  gradeLabel:  string;
  joinCode:    string;
  teacherId:   string;
  students:    StudentDef[];
  /** Representative age used for formula-based raw value computation. */
  classAge:    number;
  sessions:    Array<{ testKey: string; date: Date }>;
  testTypeIds: Map<string, string>;
  passwordHash: string;
}): Promise<void> {
  const {
    name, gradeLabel, joinCode, teacherId,
    students, classAge, sessions, testTypeIds, passwordHash,
  } = opts;

  const cls = await prisma.class.create({
    data: {
      name,
      academicYear:     '2025-2026',
      semester:         Semester.A,
      joinCode,
      joinCodeExpiresAt: new Date('2099-12-31'),
      teacherId,
      testWeight:       55,
      talmidautWeight:  45,
    },
    select: { id: true },
  });
  console.log(`\n  Class: ${name}  joinCode=${joinCode}  id=${cls.id}`);

  // Create students + enrollments
  const studentRecords: Array<{ id: string; def: StudentDef }> = [];
  for (const def of students) {
    const student = await prisma.student.create({
      data: {
        firstName:   def.firstName,
        lastName:    def.lastName,
        dateOfBirth: new Date(def.dob),
        gender:      def.gender,
        studentCode: def.code,
        passwordHash,
        enrollments: { create: { classId: cls.id } },
      },
      select: { id: true },
    });
    studentRecords.push({ id: student.id, def });
  }
  console.log(`  Students created: ${studentRecords.length}`);

  // Create test sessions + results
  for (const { testKey, date } of sessions) {
    const testTypeId = testTypeIds.get(testKey);
    if (!testTypeId) {
      console.log(`  [SKIP] No test type ID for key: ${testKey}`);
      continue;
    }

    const session = await prisma.testSession.create({
      data: { classId: cls.id, testTypeId, conductedAt: date, completedAt: date },
      select: { id: true },
    });

    const results = studentRecords.map(({ id: studentId, def }) => {
      // Compute formula-consistent raw value for this student's gender, age, and tier
      const raw = rawForTier(testKey, def.gender, classAge, def.tier);
      return {
        sessionId:       session.id,
        studentId,
        rawValue:        new Prisma.Decimal(+raw.toFixed(2)),
        calculatedGrade: TIER_GRADE[def.tier],
        recordedAt:      date,
      };
    });

    await prisma.testResult.createMany({ data: results });
    console.log(`  Session ${testKey} (${date.toISOString().slice(0, 10)}): ${results.length} results`);
  }

  // Talmida'ut records (3 monthly snapshots per student)
  const talmidautData: Array<{
    classId:       string;
    studentId:     string;
    participation: number;
    uniform:       number;
    behavior:      number;
    recordedAt:    Date;
  }> = [];

  studentRecords.forEach(({ id: studentId, def }, studentIdx) => {
    for (const snap of talmidautSnapshots(def.tier, studentIdx)) {
      talmidautData.push({ classId: cls.id, studentId, ...snap });
    }
  });
  await prisma.talmidautRecord.createMany({ data: talmidautData });
  console.log(`  Talmida'ut records: ${talmidautData.length}`);

  // StudentFinalGrade
  const finalGradeData: Array<{
    classId:          string;
    studentId:        string;
    fitnessAvg:       number;
    talmidautAvg:     number;
    recommendedGrade: number;
  }> = [];

  studentRecords.forEach(({ id: studentId, def }, studentIdx) => {
    const fitnessAvg   = TIER_GRADE[def.tier];
    const snaps        = talmidautSnapshots(def.tier, studentIdx);
    const talmidautAvg = Math.round(
      snaps.reduce((sum, s) => sum + compositeScore(s), 0) / snaps.length,
    );
    // Formula: (fitnessAvg × testWeight + talmidautAvg × talmidautWeight) / 100
    const recommendedGrade = Math.round((fitnessAvg * 55 + talmidautAvg * 45) / 100);
    finalGradeData.push({ classId: cls.id, studentId, fitnessAvg, talmidautAvg, recommendedGrade });
  });
  await prisma.studentFinalGrade.createMany({ data: finalGradeData });
  console.log(`  StudentFinalGrade records: ${finalGradeData.length}`);

  // Attendance records
  const attendanceData: Array<{
    classId:   string;
    studentId: string;
    date:      Date;
    status:    AttendanceStatus;
  }> = [];

  studentRecords.forEach(({ id: studentId, def }, studentIdx) => {
    LESSON_DATES.forEach((date, lessonIdx) => {
      attendanceData.push({
        classId: cls.id,
        studentId,
        date,
        status: getAttendanceStatus(def.tier, lessonIdx, studentIdx),
      });
    });
  });
  await prisma.attendanceRecord.createMany({ data: attendanceData });

  const absent  = attendanceData.filter((r) => r.status === AttendanceStatus.ABSENT).length;
  const late    = attendanceData.filter((r) => r.status === AttendanceStatus.LATE).length;
  console.log(
    `  Attendance: ${attendanceData.length} records ` +
    `(${attendanceData.length - absent - late} present, ${late} late, ${absent} absent)`,
  );
  console.log(`  ${gradeLabel} seeded ✓`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('══════════════════════════════════════════════════════');
  console.log('  FitGrade Database Seed — Israeli Ministry PE Tests');
  console.log('══════════════════════════════════════════════════════\n');

  await cleanupDevData();

  const testTypeIds = await seedTestTypesAndNorms();

  console.log('\nSeeding teacher...');
  const teacher = await prisma.user.create({
    data: {
      email:     'teacher@test.com',
      name:      'מורה לבדיקות',
      googleId:  'dev-google-id-do-not-use-in-prod',
      avatarUrl: null,
    },
    select: { id: true },
  });
  console.log(`  Teacher id=${teacher.id}`);

  const passwordHash = await bcrypt.hash('password123', BCRYPT_ROUNDS);

  console.log("\nSeeding grade-10 class (כיתה י' 1)...");
  await seedClass({
    name:        "כיתה י' 1",
    gradeLabel:  'Grade 10',
    joinCode:    'CLASS10',
    teacherId:   teacher.id,
    students:    STUDENTS_GRADE10,
    classAge:    16, // representative age; norm group 15–18
    sessions: [
      { testKey: 'sprint60',         date: new Date('2025-10-15') },
      { testKey: 'situps',           date: new Date('2025-11-12') },
      { testKey: 'standingLongJump', date: new Date('2025-12-10') },
      { testKey: 'flexibility',      date: new Date('2026-01-14') },
    ],
    testTypeIds,
    passwordHash,
  });

  console.log("\nSeeding grade-7 class (כיתה ז' 2)...");
  await seedClass({
    name:        "כיתה ז' 2",
    gradeLabel:  'Grade 7',
    joinCode:    'CLASS7',
    teacherId:   teacher.id,
    students:    STUDENTS_GRADE7,
    classAge:    13, // representative age; norm group 12–14
    sessions: [
      { testKey: 'sprint60', date: new Date('2025-10-15') },
      { testKey: 'pushUps',  date: new Date('2025-11-12') },
      { testKey: 'beepTest', date: new Date('2025-12-10') },
      { testKey: 'situps',   date: new Date('2026-01-14') },
    ],
    testTypeIds,
    passwordHash,
  });

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Seeding complete.');
  console.log('  Dev login:    teacher@test.com  /  /api/auth/dev-login');
  console.log('  Student (10): CLASS10 + 12345 + password123');
  console.log(`  Total test types seeded: ${testTypeIds.size}`);
  console.log('══════════════════════════════════════════════════════\n');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
