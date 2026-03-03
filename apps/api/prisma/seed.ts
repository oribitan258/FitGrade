/**
 * Prisma seed script — FitGrade development data.
 *
 * Seeds two global FitnessTestTypes with realistic NormTable rows so the
 * GradingService can be exercised without any manual DB setup.
 *
 * Run via:  pnpm prisma:seed  (or)  prisma db seed
 *
 * The script is idempotent: it deletes existing global test types (and their
 * norm rows, via CASCADE) before recreating them.
 */

import { PrismaClient, Gender, TestInputType } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Score constants — match packages/types grade-labels thresholds ──────────
const SCORE_EXCELLENT = 95;
const SCORE_VERY_GOOD = 80;
const SCORE_GOOD = 65;
const SCORE_PASS = 57;
const SCORE_FAIL = 40;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** One NormTable band: rawValue ∈ [minValue, maxValue) earns `score`. */
interface NormBand {
  gender: Gender;
  minAge: number;
  maxAge: number;
  minValue: string; // Decimal — pass as string for Prisma coercion
  maxValue: string;
  score: number;
}

// ─── 2000m Run — TIME (seconds, lower = better) ───────────────────────────────
//
// Bands cover the full range [0, ∞). `maxValue: '9999'` acts as ∞ for the
// lowest tier; no real student will run 2000m in 9999 seconds.
//
// Age group 14–17 (typical years 9–11):
const run2000Bands14to17: NormBand[] = [
  // MALE
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '0',   maxValue: '480',  score: SCORE_EXCELLENT },  // < 8 min
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '480', maxValue: '540',  score: SCORE_VERY_GOOD }, // 8–9 min
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '540', maxValue: '600',  score: SCORE_GOOD },      // 9–10 min
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '600', maxValue: '660',  score: SCORE_PASS },      // 10–11 min
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '660', maxValue: '9999', score: SCORE_FAIL },      // > 11 min
  // FEMALE
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '0',   maxValue: '540',  score: SCORE_EXCELLENT },
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '540', maxValue: '620',  score: SCORE_VERY_GOOD },
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '620', maxValue: '720',  score: SCORE_GOOD },
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '720', maxValue: '800',  score: SCORE_PASS },
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '800', maxValue: '9999', score: SCORE_FAIL },
];

// Age group 18–19 (upper high school / drafting age):
const run2000Bands18to19: NormBand[] = [
  // MALE — slightly harder thresholds at this age
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '0',   maxValue: '460',  score: SCORE_EXCELLENT },
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '460', maxValue: '520',  score: SCORE_VERY_GOOD },
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '520', maxValue: '580',  score: SCORE_GOOD },
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '580', maxValue: '640',  score: SCORE_PASS },
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '640', maxValue: '9999', score: SCORE_FAIL },
  // FEMALE
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '0',   maxValue: '520',  score: SCORE_EXCELLENT },
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '520', maxValue: '600',  score: SCORE_VERY_GOOD },
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '600', maxValue: '700',  score: SCORE_GOOD },
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '700', maxValue: '780',  score: SCORE_PASS },
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '780', maxValue: '9999', score: SCORE_FAIL },
];

// ─── Push-ups — REPS (count, higher = better) ─────────────────────────────────
//
// `maxValue: '999'` acts as ∞ for the top band.
//
// Age group 14–17:
const pushUpBands14to17: NormBand[] = [
  // MALE
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '0',  maxValue: '14',  score: SCORE_FAIL },
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '14', maxValue: '18',  score: SCORE_PASS },
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '18', maxValue: '25',  score: SCORE_GOOD },
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '25', maxValue: '35',  score: SCORE_VERY_GOOD },
  { gender: 'MALE', minAge: 14, maxAge: 17, minValue: '35', maxValue: '999', score: SCORE_EXCELLENT },
  // FEMALE
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '0',  maxValue: '9',   score: SCORE_FAIL },
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '9',  maxValue: '12',  score: SCORE_PASS },
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '12', maxValue: '18',  score: SCORE_GOOD },
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '18', maxValue: '25',  score: SCORE_VERY_GOOD },
  { gender: 'FEMALE', minAge: 14, maxAge: 17, minValue: '25', maxValue: '999', score: SCORE_EXCELLENT },
];

// Age group 18–19:
const pushUpBands18to19: NormBand[] = [
  // MALE
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '0',  maxValue: '16',  score: SCORE_FAIL },
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '16', maxValue: '20',  score: SCORE_PASS },
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '20', maxValue: '28',  score: SCORE_GOOD },
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '28', maxValue: '38',  score: SCORE_VERY_GOOD },
  { gender: 'MALE', minAge: 18, maxAge: 19, minValue: '38', maxValue: '999', score: SCORE_EXCELLENT },
  // FEMALE
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '0',  maxValue: '10',  score: SCORE_FAIL },
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '10', maxValue: '14',  score: SCORE_PASS },
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '14', maxValue: '20',  score: SCORE_GOOD },
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '20', maxValue: '28',  score: SCORE_VERY_GOOD },
  { gender: 'FEMALE', minAge: 18, maxAge: 19, minValue: '28', maxValue: '999', score: SCORE_EXCELLENT },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Delete existing global test types (NormTable rows cascade automatically).
  const deleted = await prisma.fitnessTestType.deleteMany({
    where: { isGlobal: true },
  });
  console.log(`Deleted ${deleted.count} existing global test type(s).`);

  // ── 2000m Run ──────────────────────────────────────────────────────────────
  const run2000 = await prisma.fitnessTestType.create({
    data: {
      nameHe: 'ריצת 2000 מטר',
      descriptionHe: 'ריצה רציפה של 2000 מטר — מדידת זמן בשניות',
      inputType: TestInputType.TIME,
      unit: 'שניות',
      isGlobal: true,
      normTables: {
        createMany: {
          data: [...run2000Bands14to17, ...run2000Bands18to19],
        },
      },
    },
    select: { id: true, nameHe: true, _count: { select: { normTables: true } } },
  });
  console.log(
    `Created "${run2000.nameHe}" with ${run2000._count.normTables} norm rows.`,
  );

  // ── Push-ups ───────────────────────────────────────────────────────────────
  const pushUps = await prisma.fitnessTestType.create({
    data: {
      nameHe: 'שכיבות סמיכה',
      descriptionHe: 'מספר שכיבות סמיכה מלאות — ספירת חזרות',
      inputType: TestInputType.REPS,
      unit: 'חזרות',
      isGlobal: true,
      normTables: {
        createMany: {
          data: [...pushUpBands14to17, ...pushUpBands18to19],
        },
      },
    },
    select: { id: true, nameHe: true, _count: { select: { normTables: true } } },
  });
  console.log(
    `Created "${pushUps.nameHe}" with ${pushUps._count.normTables} norm rows.`,
  );

  console.log('Seeding complete.');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
