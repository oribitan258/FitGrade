/**
 * Prisma seed script — FitGrade full development dataset.
 *
 * Seeds:
 *  - 4 global FitnessTestTypes with Ministry of Education norm tables
 *  - 1 teacher, 1 class "כיתה י' 1" (joinCode: CLASS10)
 *  - 15 students with authentic Israeli names and varied performance tiers
 *  - 4 test sessions (Oct–Jan) with results covering the full score distribution
 *  - 26 attendance records per student (Sep 2025 – Mar 2026)
 *
 * Idempotent: removes existing dev data (by joinCode CLASS10) before re-seeding.
 * Run via: pnpm prisma:seed  (or)  npx prisma db seed
 */

import { AttendanceStatus, FitnessInputType, Gender, Prisma, PrismaClient, Semester } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Score constants (match packages/types grade-label thresholds) ────────────
const SCORE_EXCELLENT = 95;
const SCORE_VERY_GOOD = 80;
const SCORE_GOOD      = 65;
const SCORE_PASS      = 57;
const SCORE_FAIL      = 40;

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'PASS' | 'FAIL';

interface NormBand {
  gender: Gender;
  minAge: number;
  maxAge: number;
  minValue: string; // Decimal — string for Prisma coercion
  maxValue: string;
  score: number;
}

interface StudentDef {
  firstName: string;
  lastName: string;
  dob: string;        // ISO date string
  gender: Gender;
  code: string;
  tier: Tier;
}

// ─── Tier → grade mapping ─────────────────────────────────────────────────────
const TIER_GRADE: Record<Tier, number> = {
  EXCELLENT: SCORE_EXCELLENT,
  VERY_GOOD: SCORE_VERY_GOOD,
  GOOD:      SCORE_GOOD,
  PASS:      SCORE_PASS,
  FAIL:      SCORE_FAIL,
};

// ─────────────────────────────────────────────────────────────────────────────
// NORM TABLES
// ─────────────────────────────────────────────────────────────────────────────

// 2000m Run — TIME (seconds, lower = better)
const run2000Norms: NormBand[] = [
  // MALE 14–17
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '0',   maxValue: '480',  score: SCORE_EXCELLENT },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '480', maxValue: '540',  score: SCORE_VERY_GOOD },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '540', maxValue: '600',  score: SCORE_GOOD },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '600', maxValue: '660',  score: SCORE_PASS },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '660', maxValue: '9999', score: SCORE_FAIL },
  // FEMALE 14–17
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '0',   maxValue: '540',  score: SCORE_EXCELLENT },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '540', maxValue: '620',  score: SCORE_VERY_GOOD },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '620', maxValue: '720',  score: SCORE_GOOD },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '720', maxValue: '800',  score: SCORE_PASS },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '800', maxValue: '9999', score: SCORE_FAIL },
  // MALE 18–19
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '0',   maxValue: '460',  score: SCORE_EXCELLENT },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '460', maxValue: '520',  score: SCORE_VERY_GOOD },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '520', maxValue: '580',  score: SCORE_GOOD },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '580', maxValue: '640',  score: SCORE_PASS },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '640', maxValue: '9999', score: SCORE_FAIL },
  // FEMALE 18–19
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '0',   maxValue: '520',  score: SCORE_EXCELLENT },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '520', maxValue: '600',  score: SCORE_VERY_GOOD },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '600', maxValue: '700',  score: SCORE_GOOD },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '700', maxValue: '780',  score: SCORE_PASS },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '780', maxValue: '9999', score: SCORE_FAIL },
];

// Push-ups — REPS (higher = better)
const pushUpNorms: NormBand[] = [
  // MALE 14–17
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '0',  maxValue: '14',  score: SCORE_FAIL },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '14', maxValue: '18',  score: SCORE_PASS },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '18', maxValue: '25',  score: SCORE_GOOD },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '25', maxValue: '35',  score: SCORE_VERY_GOOD },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '35', maxValue: '999', score: SCORE_EXCELLENT },
  // FEMALE 14–17
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '0',  maxValue: '9',   score: SCORE_FAIL },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '9',  maxValue: '12',  score: SCORE_PASS },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '12', maxValue: '18',  score: SCORE_GOOD },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '18', maxValue: '25',  score: SCORE_VERY_GOOD },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '25', maxValue: '999', score: SCORE_EXCELLENT },
  // MALE 18–19
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '0',  maxValue: '16',  score: SCORE_FAIL },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '16', maxValue: '20',  score: SCORE_PASS },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '20', maxValue: '28',  score: SCORE_GOOD },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '28', maxValue: '38',  score: SCORE_VERY_GOOD },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '38', maxValue: '999', score: SCORE_EXCELLENT },
  // FEMALE 18–19
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '0',  maxValue: '10',  score: SCORE_FAIL },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '10', maxValue: '14',  score: SCORE_PASS },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '14', maxValue: '20',  score: SCORE_GOOD },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '20', maxValue: '28',  score: SCORE_VERY_GOOD },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '28', maxValue: '999', score: SCORE_EXCELLENT },
];

// Pull-ups (boys) / Sit-ups in 30 sec (girls) — REPS
const pullUpSitUpNorms: NormBand[] = [
  // MALE 14–17 (pull-ups)
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '0',  maxValue: '3',  score: SCORE_FAIL },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '3',  maxValue: '6',  score: SCORE_PASS },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '6',  maxValue: '10', score: SCORE_GOOD },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '10', maxValue: '15', score: SCORE_VERY_GOOD },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '15', maxValue: '99', score: SCORE_EXCELLENT },
  // FEMALE 14–17 (sit-ups)
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '0',  maxValue: '14',  score: SCORE_FAIL },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '14', maxValue: '20',  score: SCORE_PASS },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '20', maxValue: '27',  score: SCORE_GOOD },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '27', maxValue: '35',  score: SCORE_VERY_GOOD },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '35', maxValue: '999', score: SCORE_EXCELLENT },
  // MALE 18–19 (pull-ups)
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '0',  maxValue: '4',  score: SCORE_FAIL },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '4',  maxValue: '7',  score: SCORE_PASS },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '7',  maxValue: '11', score: SCORE_GOOD },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '11', maxValue: '16', score: SCORE_VERY_GOOD },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '16', maxValue: '99', score: SCORE_EXCELLENT },
  // FEMALE 18–19 (sit-ups)
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '0',  maxValue: '16',  score: SCORE_FAIL },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '16', maxValue: '22',  score: SCORE_PASS },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '22', maxValue: '29',  score: SCORE_GOOD },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '29', maxValue: '37',  score: SCORE_VERY_GOOD },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '37', maxValue: '999', score: SCORE_EXCELLENT },
];

// Forward-bend flexibility — GENERAL (centimeters, higher = better)
const flexibilityNorms: NormBand[] = [
  // MALE 14–17
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '0',  maxValue: '5',  score: SCORE_FAIL },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '5',  maxValue: '10', score: SCORE_PASS },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '10', maxValue: '16', score: SCORE_GOOD },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '16', maxValue: '22', score: SCORE_VERY_GOOD },
  { gender: Gender.MALE, minAge: 14, maxAge: 17, minValue: '22', maxValue: '99', score: SCORE_EXCELLENT },
  // FEMALE 14–17
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '0',  maxValue: '8',  score: SCORE_FAIL },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '8',  maxValue: '14', score: SCORE_PASS },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '14', maxValue: '20', score: SCORE_GOOD },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '20', maxValue: '28', score: SCORE_VERY_GOOD },
  { gender: Gender.FEMALE, minAge: 14, maxAge: 17, minValue: '28', maxValue: '99', score: SCORE_EXCELLENT },
  // MALE 18–19
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '0',  maxValue: '4',  score: SCORE_FAIL },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '4',  maxValue: '9',  score: SCORE_PASS },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '9',  maxValue: '15', score: SCORE_GOOD },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '15', maxValue: '21', score: SCORE_VERY_GOOD },
  { gender: Gender.MALE, minAge: 18, maxAge: 19, minValue: '21', maxValue: '99', score: SCORE_EXCELLENT },
  // FEMALE 18–19
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '0',  maxValue: '10', score: SCORE_FAIL },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '10', maxValue: '16', score: SCORE_PASS },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '16', maxValue: '22', score: SCORE_GOOD },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '22', maxValue: '30', score: SCORE_VERY_GOOD },
  { gender: Gender.FEMALE, minAge: 18, maxAge: 19, minValue: '30', maxValue: '99', score: SCORE_EXCELLENT },
];

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ROSTER — 15 students, authentic Israeli names
// Distribution: 3 EXCELLENT, 4 VERY_GOOD, 4 GOOD, 2 PASS, 2 FAIL
// Student code '12345' is the dev portal login student
// ─────────────────────────────────────────────────────────────────────────────
const STUDENTS: StudentDef[] = [
  // ── Males (8) ──
  { firstName: 'אביב',   lastName: 'כהן',        dob: '2009-03-15', gender: Gender.MALE,   code: '101',   tier: 'EXCELLENT' },
  { firstName: 'אורן',   lastName: 'גולדשטיין',  dob: '2008-12-12', gender: Gender.MALE,   code: '102',   tier: 'EXCELLENT' },
  { firstName: 'יונתן',  lastName: 'לוי',         dob: '2009-07-22', gender: Gender.MALE,   code: '103',   tier: 'VERY_GOOD' },
  { firstName: 'מתן',    lastName: 'אברהם',       dob: '2008-11-30', gender: Gender.MALE,   code: '104',   tier: 'VERY_GOOD' },
  { firstName: 'נדב',    lastName: 'מזרחי',       dob: '2009-05-10', gender: Gender.MALE,   code: '105',   tier: 'GOOD' },
  { firstName: "רון",    lastName: "ברקוביץ'",    dob: '2009-01-18', gender: Gender.MALE,   code: '106',   tier: 'GOOD' },
  { firstName: 'תלמיד',  lastName: 'בדיקות',      dob: '2008-06-15', gender: Gender.MALE,   code: '12345', tier: 'PASS' },  // dev portal login
  { firstName: 'דניאל',  lastName: 'פרידמן',      dob: '2009-02-28', gender: Gender.MALE,   code: '108',   tier: 'FAIL' },
  // ── Females (7) ──
  { firstName: 'שירה',   lastName: 'כץ',          dob: '2009-04-20', gender: Gender.FEMALE, code: '109',   tier: 'EXCELLENT' },
  { firstName: 'מאיה',   lastName: 'דוד',         dob: '2009-08-14', gender: Gender.FEMALE, code: '110',   tier: 'VERY_GOOD' },
  { firstName: 'ליאת',   lastName: 'חיים',        dob: '2008-06-03', gender: Gender.FEMALE, code: '111',   tier: 'VERY_GOOD' },
  { firstName: 'נועה',   lastName: 'פרץ',         dob: '2009-10-25', gender: Gender.FEMALE, code: '112',   tier: 'GOOD' },
  { firstName: 'יובל',   lastName: 'אשכנזי',      dob: '2009-06-30', gender: Gender.FEMALE, code: '113',   tier: 'GOOD' },
  { firstName: 'תמר',    lastName: 'גרינברג',     dob: '2008-03-17', gender: Gender.FEMALE, code: '114',   tier: 'PASS' },
  { firstName: 'ענבל',   lastName: 'שמיר',        dob: '2009-12-08', gender: Gender.FEMALE, code: '115',   tier: 'FAIL' },
];

// ─────────────────────────────────────────────────────────────────────────────
// RAW VALUES — deterministic values that produce the expected grade tier.
// Verified against the norm bands above.
// ─────────────────────────────────────────────────────────────────────────────
const RAW_VALUES: Record<string, Record<Gender, Record<Tier, number>>> = {
  run2000: {
    // TIME: lower = better (seconds). All students are 14–17 at test time.
    [Gender.MALE]:   { EXCELLENT: 450, VERY_GOOD: 510, GOOD: 565, PASS: 625, FAIL: 720 },
    [Gender.FEMALE]: { EXCELLENT: 510, VERY_GOOD: 580, GOOD: 670, PASS: 760, FAIL: 850 },
    [Gender.OTHER]:  { EXCELLENT: 480, VERY_GOOD: 545, GOOD: 617, PASS: 692, FAIL: 785 },
  },
  pushUps: {
    // REPS: higher = better
    [Gender.MALE]:   { EXCELLENT: 38, VERY_GOOD: 28, GOOD: 21, PASS: 15, FAIL: 10 },
    [Gender.FEMALE]: { EXCELLENT: 28, VERY_GOOD: 20, GOOD: 14, PASS: 10, FAIL:  6 },
    [Gender.OTHER]:  { EXCELLENT: 33, VERY_GOOD: 24, GOOD: 17, PASS: 12, FAIL:  8 },
  },
  pullUpSitUp: {
    // REPS: higher = better. Males = pull-ups; females = sit-ups
    [Gender.MALE]:   { EXCELLENT: 17, VERY_GOOD: 12, GOOD:  8, PASS:  4, FAIL:  2 },
    [Gender.FEMALE]: { EXCELLENT: 38, VERY_GOOD: 30, GOOD: 24, PASS: 17, FAIL: 10 },
    [Gender.OTHER]:  { EXCELLENT: 27, VERY_GOOD: 21, GOOD: 16, PASS: 10, FAIL:  6 },
  },
  flexibility: {
    // GENERAL: cm, higher = better
    [Gender.MALE]:   { EXCELLENT: 25, VERY_GOOD: 18, GOOD: 12, PASS:  7, FAIL:  3 },
    [Gender.FEMALE]: { EXCELLENT: 32, VERY_GOOD: 24, GOOD: 17, PASS: 11, FAIL:  5 },
    [Gender.OTHER]:  { EXCELLENT: 28, VERY_GOOD: 21, GOOD: 14, PASS:  9, FAIL:  4 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LESSON DATES — 26 lessons, 2× per week, Sep 2025 → Mar 2026
// Test session dates are embedded in the regular lesson schedule.
// ─────────────────────────────────────────────────────────────────────────────
const LESSON_DATES: Date[] = [
  // September 2025
  new Date('2025-09-03'), new Date('2025-09-07'),
  new Date('2025-09-14'), new Date('2025-09-21'),
  // October 2025
  new Date('2025-10-01'), new Date('2025-10-08'),
  new Date('2025-10-15'), // ← ריצת 2000 מטר session
  new Date('2025-10-22'), new Date('2025-10-29'),
  // November 2025
  new Date('2025-11-05'),
  new Date('2025-11-12'), // ← שכיבות סמיכה session
  new Date('2025-11-19'), new Date('2025-11-26'),
  // December 2025
  new Date('2025-12-03'),
  new Date('2025-12-10'), // ← מתח/כפיפות בטן session
  new Date('2025-12-17'), new Date('2025-12-24'),
  // January 2026
  new Date('2026-01-07'),
  new Date('2026-01-14'), // ← גמישות session
  new Date('2026-01-21'), new Date('2026-01-28'),
  // February 2026
  new Date('2026-02-04'), new Date('2026-02-11'),
  new Date('2026-02-18'), new Date('2026-02-25'),
  // March 2026
  new Date('2026-03-04'),
];

const TOTAL_LESSONS = LESSON_DATES.length; // 26

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE PATTERNS — deterministic absence/late indices per tier
// ─────────────────────────────────────────────────────────────────────────────

/** Lesson indices (0-based) on which this tier is absent, before per-student shift. */
const ABSENT_INDICES: Record<Tier, number[]> = {
  EXCELLENT: [20],
  VERY_GOOD: [5, 18],
  GOOD:      [3, 11, 22],
  PASS:      [1, 8, 15, 21, 24],
  FAIL:      [2, 5, 9, 13, 16, 19, 22, 25],
};

/** Lesson indices on which this tier is late, before per-student shift. */
const LATE_INDICES: Record<Tier, number[]> = {
  EXCELLENT: [],
  VERY_GOOD: [12],
  GOOD:      [7, 19],
  PASS:      [4, 14],
  FAIL:      [4, 10, 23],
};

function getAttendanceStatus(tier: Tier, lessonIdx: number, studentIdx: number): AttendanceStatus {
  // Shift by studentIdx so every student has a slightly unique pattern
  const shift = studentIdx % 5;
  const absent = ABSENT_INDICES[tier].map((i) => (i + shift) % TOTAL_LESSONS);
  const late   = LATE_INDICES[tier].map((i) => (i + shift) % TOTAL_LESSONS);
  if (absent.includes(lessonIdx)) return AttendanceStatus.ABSENT;
  if (late.includes(lessonIdx))   return AttendanceStatus.LATE;
  return AttendanceStatus.PRESENT;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function cleanupDevData(): Promise<void> {
  console.log('Cleaning up previous dev data...');

  // Find the dev class by its fixed join code
  const existing = await prisma.class.findFirst({
    where: { joinCode: 'CLASS10' },
    select: { id: true, enrollments: { select: { studentId: true } } },
  });

  if (existing) {
    const studentIds = existing.enrollments.map((e) => e.studentId);
    // Deleting the class cascades: enrollments, testSessions→testResults, attendanceRecords
    await prisma.class.delete({ where: { id: existing.id } });
    if (studentIds.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    }
    console.log(`  Removed dev class and ${studentIds.length} student(s).`);
  }

  await prisma.user.deleteMany({ where: { email: 'teacher@test.com' } });

  const { count } = await prisma.fitnessTestType.deleteMany({ where: { isGlobal: true } });
  console.log(`  Removed ${count} global FitnessTestType(s).`);
}

async function seedTestTypes(): Promise<Record<string, string>> {
  console.log('\nSeeding FitnessTestTypes + NormTables...');

  const [run2000, pushUps, pullUpSitUp, flexibility] = await Promise.all([
    prisma.fitnessTestType.create({
      data: {
        nameHe: 'ריצת 2000 מטר',
        descriptionHe: 'ריצה רציפה של 2000 מטר — מדידת זמן בשניות',
        inputType: FitnessInputType.TIME,
        unit: 'שניות',
        isGlobal: true,
        normTables: { createMany: { data: run2000Norms } },
      },
      select: { id: true },
    }),
    prisma.fitnessTestType.create({
      data: {
        nameHe: 'שכיבות סמיכה',
        descriptionHe: 'מספר שכיבות סמיכה מלאות — ספירת חזרות',
        inputType: FitnessInputType.REPS,
        unit: 'חזרות',
        isGlobal: true,
        normTables: { createMany: { data: pushUpNorms } },
      },
      select: { id: true },
    }),
    prisma.fitnessTestType.create({
      data: {
        nameHe: 'מתח / כפיפות בטן',
        descriptionHe: 'בנים: מתח — בנות: כפיפות בטן ב-30 שניות',
        inputType: FitnessInputType.REPS,
        unit: 'חזרות',
        isGlobal: true,
        normTables: { createMany: { data: pullUpSitUpNorms } },
      },
      select: { id: true },
    }),
    prisma.fitnessTestType.create({
      data: {
        nameHe: 'גמישות — כפיפת גו קדימה',
        descriptionHe: 'כפיפת גו קדימה — מדידה בסנטימטרים',
        inputType: FitnessInputType.GENERAL,
        unit: 'ס"מ',
        isGlobal: true,
        normTables: { createMany: { data: flexibilityNorms } },
      },
      select: { id: true },
    }),
  ]);

  const normCounts = [run2000Norms, pushUpNorms, pullUpSitUpNorms, flexibilityNorms].map((n) => n.length);
  console.log(`  Created 4 test types with ${normCounts.join(', ')} norm bands respectively.`);

  return {
    run2000:     run2000.id,
    pushUps:     pushUps.id,
    pullUpSitUp: pullUpSitUp.id,
    flexibility: flexibility.id,
  };
}

async function seedClassroomData(): Promise<{
  classId: string;
  studentRecords: Array<{ id: string; def: StudentDef }>;
}> {
  console.log('\nSeeding teacher, class, and students...');

  const teacher = await prisma.user.create({
    data: {
      email: 'teacher@test.com',
      name: 'מורה לבדיקות',
      googleId: 'dev-google-id-do-not-use-in-prod',
      avatarUrl: null,
    },
    select: { id: true },
  });

  const cls = await prisma.class.create({
    data: {
      name: "כיתה י' 1",
      academicYear: '2025-2026',
      semester: Semester.A,
      joinCode: 'CLASS10',
      joinCodeExpiresAt: new Date('2099-12-31'),
      teacherId: teacher.id,
    },
    select: { id: true },
  });

  // Hash once — same password for all dev students
  const passwordHash = await bcrypt.hash('password123', 10);
  const studentRecords: Array<{ id: string; def: StudentDef }> = [];

  for (const def of STUDENTS) {
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

  console.log(`  Teacher: ${teacher.id}`);
  console.log(`  Class: ${cls.id}  joinCode=CLASS10`);
  console.log(`  Students: ${studentRecords.length} created and enrolled.`);

  return { classId: cls.id, studentRecords };
}

async function seedTestSessions(
  testTypeIds: Record<string, string>,
  classId: string,
  studentRecords: Array<{ id: string; def: StudentDef }>,
): Promise<void> {
  console.log('\nSeeding test sessions and results...');

  const sessions = [
    { key: 'run2000',     testTypeId: testTypeIds['run2000']!,     date: new Date('2025-10-15') },
    { key: 'pushUps',     testTypeId: testTypeIds['pushUps']!,     date: new Date('2025-11-12') },
    { key: 'pullUpSitUp', testTypeId: testTypeIds['pullUpSitUp']!, date: new Date('2025-12-10') },
    { key: 'flexibility', testTypeId: testTypeIds['flexibility']!, date: new Date('2026-01-14') },
  ];

  for (const { key, testTypeId, date } of sessions) {
    const session = await prisma.testSession.create({
      data: {
        classId,
        testTypeId,
        conductedAt: date,
        completedAt: date,
        isStopwatch: false,
      },
      select: { id: true },
    });

    const testRawValues = RAW_VALUES[key]!;

    const results = studentRecords.map(({ id: studentId, def }) => ({
      sessionId:       session.id,
      studentId,
      rawValue:        new Prisma.Decimal(testRawValues[def.gender][def.tier]),
      calculatedGrade: TIER_GRADE[def.tier],
      recordedAt:      date,
    }));

    await prisma.testResult.createMany({ data: results });
    console.log(`  ${key} (${date.toISOString().slice(0, 10)}): ${results.length} results.`);
  }
}

async function seedAttendance(
  classId: string,
  studentRecords: Array<{ id: string; def: StudentDef }>,
): Promise<void> {
  console.log('\nSeeding attendance records...');

  const attendanceData: Array<{
    classId: string;
    studentId: string;
    date: Date;
    status: AttendanceStatus;
  }> = [];

  studentRecords.forEach(({ id: studentId, def }, studentIdx) => {
    LESSON_DATES.forEach((date, lessonIdx) => {
      attendanceData.push({
        classId,
        studentId,
        date,
        status: getAttendanceStatus(def.tier, lessonIdx, studentIdx),
      });
    });
  });

  await prisma.attendanceRecord.createMany({ data: attendanceData });

  const absent  = attendanceData.filter((r) => r.status === AttendanceStatus.ABSENT).length;
  const late    = attendanceData.filter((r) => r.status === AttendanceStatus.LATE).length;
  const present = attendanceData.length - absent - late;
  console.log(
    `  ${attendanceData.length} records: ${present} present, ${late} late, ${absent} absent.`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  FitGrade Database Seed');
  console.log('═══════════════════════════════════════\n');

  await cleanupDevData();
  const testTypeIds = await seedTestTypes();
  const { classId, studentRecords } = await seedClassroomData();
  await seedTestSessions(testTypeIds, classId, studentRecords);
  await seedAttendance(classId, studentRecords);

  console.log('\n═══════════════════════════════════════');
  console.log('  Seeding complete.');
  console.log('  Dev login:  teacher@test.com  /  /api/auth/dev-login');
  console.log('  Student:    CLASS10 + 12345 + password123');
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
