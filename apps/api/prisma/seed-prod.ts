/**
 * Production seed — system bootstrap data ONLY.
 *
 * Seeds:
 *  - 13 Israeli Ministry of Education FitnessTestTypes
 *  - Formula-based NormTable bands (per test × gender × grade level)
 *
 * Does NOT seed: teachers, students, classes, sessions, results.
 *
 * Safe to run multiple times: wipes and re-creates the global test types
 * and all NormTable rows on every run. Teacher data is untouched.
 *
 * Run via:
 *   DATABASE_URL=... DIRECT_URL=... npx ts-node prisma/seed-prod.ts
 */

import {
  FitnessInputType,
  Gender,
  Prisma,
  PrismaClient,
  TestCategory,
} from '@prisma/client';
import { NORM_CONFIG } from './norms.config';
import type { ScoreThresholds } from './norms.config';

const prisma = new PrismaClient();

interface NormBandInput {
  gender:     Gender;
  gradeLevel: number;
  minValue:   string;
  maxValue:   string;
  score:      number;
}

function rawAtScoreFromThresholds(score: number, t: ScoreThresholds): number {
  if (score >= 100) return t.s100;
  if (score >= 90) return t.s100 + (100 - score) * (t.s90  - t.s100) / 10;
  if (score >= 80) return t.s90  + (90  - score) * (t.s80  - t.s90)  / 10;
  if (score >= 70) return t.s80  + (80  - score) * (t.s70  - t.s80)  / 10;
  if (score >= 60) return t.s70  + (70  - score) * (t.s60  - t.s70)  / 10;
  if (score >= 50) return t.s60  + (60  - score) * (t.s50  - t.s60)  / 10;
  const slope = (t.s50 - t.s60) / 10;
  return t.s50 + (50 - score) * slope;
}

function generateBandsFromThresholds(
  thresholds: ScoreThresholds,
  isTime:     boolean,
  gender:     Gender,
  gradeLevel: number,
): NormBandInput[] {
  const EPS = 0.0001;
  const bands: NormBandInput[] = [];
  const raw = (s: number): number => rawAtScoreFromThresholds(s, thresholds);

  if (isTime) {
    bands.push({
      gender, gradeLevel, score: 100,
      minValue: '0',
      maxValue: String(+(raw(100) + EPS).toFixed(4)),
    });
    for (let s = 99; s >= 2; s--) {
      bands.push({
        gender, gradeLevel, score: s,
        minValue: String(+(raw(s + 1) + EPS).toFixed(4)),
        maxValue: String(+(raw(s)     + EPS).toFixed(4)),
      });
    }
    bands.push({
      gender, gradeLevel, score: 1,
      minValue: String(+(raw(2) + EPS).toFixed(4)),
      maxValue: '999999',
    });
  } else {
    bands.push({
      gender, gradeLevel, score: 100,
      minValue: String(+Math.max(0, raw(100)).toFixed(4)),
      maxValue: '999999',
    });
    for (let s = 99; s >= 2; s--) {
      const lo = +Math.max(0, raw(s)    ).toFixed(4);
      const hi = +Math.max(0, raw(s + 1)).toFixed(4);
      if (lo >= hi) continue;
      bands.push({
        gender, gradeLevel, score: s,
        minValue: String(lo),
        maxValue: String(hi),
      });
    }
    const catchAllMax = +Math.max(0, raw(2)).toFixed(4);
    if (catchAllMax > 0) {
      bands.push({
        gender, gradeLevel, score: 1,
        minValue: '0',
        maxValue: String(catchAllMax),
      });
    }
  }

  return bands;
}

function validateNoBandOverlaps(testKey: string, bands: NormBandInput[]): void {
  const groups = new Map<string, NormBandInput[]>();
  for (const b of bands) {
    const key = `${b.gender}|${b.gradeLevel}`;
    const group = groups.get(key) ?? [];
    group.push(b);
    groups.set(key, group);
  }
  for (const [groupKey, groupBands] of groups) {
    const sorted = [...groupBands].sort((a, b) => parseFloat(a.minValue) - parseFloat(b.minValue));
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur  = sorted[i];
      const next = sorted[i + 1];
      const curMax  = parseFloat(cur.maxValue);
      const nextMin = parseFloat(next.minValue);
      if (curMax > nextMin) {
        throw new Error(
          `Overlapping NormTable bands in test "${testKey}" group [${groupKey}]: ` +
          `score ${cur.score} maxValue=${curMax} > score ${next.score} minValue=${nextMin}`,
        );
      }
    }
  }
}

async function main(): Promise<void> {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Production seed — system data only');
  console.log('══════════════════════════════════════════════════════\n');

  console.log('Wiping all existing global FitnessTestTypes and NormTable rows...');
  await prisma.normTable.deleteMany({});
  const { count: removed } = await prisma.fitnessTestType.deleteMany({ where: { isGlobal: true } });
  console.log(`  Removed ${removed} global FitnessTestType(s) and all associated NormTable rows.\n`);

  console.log('Seeding FitnessTestTypes + NormTables...');
  let totalTypes = 0;
  let totalBands = 0;

  for (const config of NORM_CONFIG) {
    const bands: NormBandInput[] = [];
    for (const levelGroup of config.gradeLevels) {
      for (const [genderStr, thresholds] of Object.entries(levelGroup.byGender) as [string, ScoreThresholds | undefined][]) {
        if (!thresholds) continue;
        const gender = genderStr as Gender;
        for (const gradeLevel of levelGroup.grades) {
          const groupBands = generateBandsFromThresholds(
            thresholds,
            !config.higherIsBetter,
            gender,
            gradeLevel,
          );
          bands.push(...groupBands);
        }
      }
    }

    validateNoBandOverlaps(config.testKey, bands);

    await prisma.fitnessTestType.create({
      data: {
        nameHe:         config.nameHe,
        descriptionHe:  config.descriptionHe,
        inputType:      config.inputType as FitnessInputType,
        unit:           config.unit,
        isGlobal:       true,
        higherIsBetter: config.higherIsBetter,
        category:       config.category as TestCategory,
        minGrade:       config.minGrade,
        maxGrade:       config.maxGrade,
        normTables: {
          createMany: {
            data: bands.map((b) => ({
              gender:     b.gender,
              gradeLevel: b.gradeLevel,
              minValue:   new Prisma.Decimal(b.minValue),
              maxValue:   new Prisma.Decimal(b.maxValue),
              score:      b.score,
            })),
          },
        },
      },
    });

    totalTypes += 1;
    totalBands += bands.length;
    console.log(`  ✓ ${config.nameHe} — ${bands.length} norm bands`);
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Production seed complete.`);
  console.log(`  Test types created: ${totalTypes}`);
  console.log(`  Norm bands created: ${totalBands}`);
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
