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
 *   Piecewise interpolation across 6 score anchors (s100/s90/s80/s70/s60/s50) per gender × age group.
 *   Defined in apps/api/prisma/norms.config.ts; generated via generateBandsFromThresholds().
 */

import {
  AttendanceStatus,
  FitnessInputType,
  Gender,
  Prisma,
  PrismaClient,
  TestCategory,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { NORM_CONFIG, findThresholds } from './norms.config';
import type { ScoreThresholds } from './norms.config';

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

interface NormBandInput {
  gender:     Gender;
  gradeLevel: number;
  minValue:   string;
  maxValue:   string;
  score:      number;
}

// TEST_TYPES and NORM_SPECS are replaced by NORM_CONFIG imported from norms.config.ts.

// ─────────────────────────────────────────────────────────────────────────────
// NORM TABLE TARGETS (per test × gender × age group)
// Age groups — elementary and per-grade secondary resolution:
//   ה–ו: 10–12  |  ז': 12–13  |  ח': 13–14  |  ט': 14–15  |  י': 15–16  |  י"א: 16–17  |  י"ב: 17–18
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// FORMULA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the raw measurement value corresponding to a given score using
 * piecewise linear interpolation across the 6 score anchors in ScoreThresholds.
 *
 * Segments: 100→90, 90→80, 80→70, 70→60, 60→50, then extrapolates below 50
 * using the same slope as the 60→50 segment.
 */
function rawAtScoreFromThresholds(score: number, t: ScoreThresholds): number {
  if (score >= 100) return t.s100;
  if (score >= 90) return t.s100 + (100 - score) * (t.s90  - t.s100) / 10;
  if (score >= 80) return t.s90  + (90  - score) * (t.s80  - t.s90)  / 10;
  if (score >= 70) return t.s80  + (80  - score) * (t.s70  - t.s80)  / 10;
  if (score >= 60) return t.s70  + (70  - score) * (t.s60  - t.s70)  / 10;
  if (score >= 50) return t.s60  + (60  - score) * (t.s50  - t.s60)  / 10;
  // Below 50: extrapolate by extending the slope of the 60→50 segment
  const slope = (t.s50 - t.s60) / 10;
  return t.s50 + (50 - score) * slope;
}

function rawForTier(testKey: string, gender: Gender, gradeLevel: number, tier: Tier): number {
  const thresholds = findThresholds(testKey, gender as 'MALE' | 'FEMALE', gradeLevel);
  if (!thresholds) throw new Error(`No norm thresholds for ${testKey}/${gender}/grade=${gradeLevel}`);
  return rawAtScoreFromThresholds(TIER_GRADE[tier], thresholds);
}

/**
 * Generates NormTable band records for one test/gender/ageGroup combination
 * from the 6-anchor ScoreThresholds.
 *
 * NormTable lookup condition: minValue ≤ rawValue < maxValue
 *
 * For TIME (isTime=true, lower=better):
 *   Score 100: [0, raw(100)+ε)
 *   Score s:   [raw(s+1)+ε, raw(s)+ε)
 *   Score 1:   [raw(2)+ε, 999999)
 *
 * For REPS/GENERAL (isTime=false, higher=better):
 *   Score 100: [raw(100), 999999)
 *   Score s:   [raw(s), raw(s+1))
 *   Score 1:   [0, raw(2))
 */
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
      if (lo >= hi) continue; // degenerate band — raw values collapsed at floor 0
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
    // Sort by minValue ascending
    const sorted = [...groupBands].sort((a, b) => parseFloat(a.minValue) - parseFloat(b.minValue));
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      const curMax = parseFloat(cur.maxValue);
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

/** Grade 2 class (כיתה ב' 1) — students born 2018–2019, age ~7 at test time. */
const STUDENTS_GRADE2: StudentDef[] = [
  { firstName: 'עומר',    lastName: 'לוי',       dob: '2018-04-10', gender: Gender.MALE,   code: '301', tier: 'EXCELLENT' },
  { firstName: 'דור',     lastName: 'כהן',       dob: '2019-01-15', gender: Gender.MALE,   code: '302', tier: 'VERY_GOOD' },
  { firstName: 'יהונתן',  lastName: 'שלום',      dob: '2018-08-22', gender: Gender.MALE,   code: '303', tier: 'GOOD'      },
  { firstName: 'אריאל',   lastName: 'ביטון',     dob: '2019-03-05', gender: Gender.MALE,   code: '304', tier: 'PASS'      },
  { firstName: 'שון',     lastName: 'פרץ',       dob: '2018-11-17', gender: Gender.MALE,   code: '305', tier: 'FAIL'      },
  { firstName: 'מיה',     lastName: 'דוד',       dob: '2018-05-25', gender: Gender.FEMALE, code: '306', tier: 'EXCELLENT' },
  { firstName: 'אלה',     lastName: 'גרין',      dob: '2019-02-10', gender: Gender.FEMALE, code: '307', tier: 'VERY_GOOD' },
  { firstName: 'חן',      lastName: 'אברהם',     dob: '2018-09-30', gender: Gender.FEMALE, code: '308', tier: 'GOOD'      },
  { firstName: 'ליאור',   lastName: 'מזרחי',     dob: '2019-06-14', gender: Gender.FEMALE, code: '309', tier: 'PASS'      },
  { firstName: 'שיר',     lastName: 'שפירא',     dob: '2018-12-01', gender: Gender.FEMALE, code: '310', tier: 'FAIL'      },
];

/** Grade 4 class (כיתה ד' 1) — students born 2016–2017, age ~9 at test time. */
const STUDENTS_GRADE4: StudentDef[] = [
  { firstName: 'גיא',     lastName: 'שחר',       dob: '2016-03-18', gender: Gender.MALE,   code: '401', tier: 'EXCELLENT' },
  { firstName: 'נמרוד',   lastName: 'לוי',       dob: '2017-01-22', gender: Gender.MALE,   code: '402', tier: 'VERY_GOOD' },
  { firstName: 'עידן',    lastName: 'כהן',       dob: '2016-07-09', gender: Gender.MALE,   code: '403', tier: 'GOOD'      },
  { firstName: 'יואל',    lastName: 'ניסים',     dob: '2017-04-27', gender: Gender.MALE,   code: '404', tier: 'PASS'      },
  { firstName: 'רועי',    lastName: 'בר',        dob: '2016-10-03', gender: Gender.MALE,   code: '405', tier: 'FAIL'      },
  { firstName: 'נגה',     lastName: 'אלון',      dob: '2016-05-12', gender: Gender.FEMALE, code: '406', tier: 'EXCELLENT' },
  { firstName: 'ניל',     lastName: 'רוז',       dob: '2017-02-28', gender: Gender.FEMALE, code: '407', tier: 'VERY_GOOD' },
  { firstName: 'רמי',     lastName: 'גל',        dob: '2016-08-19', gender: Gender.FEMALE, code: '408', tier: 'GOOD'      },
  { firstName: 'דנה',     lastName: 'שם טוב',   dob: '2017-05-04', gender: Gender.FEMALE, code: '409', tier: 'PASS'      },
  { firstName: 'אביגיל',  lastName: 'כץ',        dob: '2016-11-11', gender: Gender.FEMALE, code: '410', tier: 'FAIL'      },
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
  lessonDate:    Date;
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
      lessonDate:    new Date('2025-10-31'),
      recordedAt:    new Date('2025-10-31'),
    },
    {
      participation: jitter(p, (studentIdx + 1) % 5),
      uniform:       jitter(u, (studentIdx + 2) % 4),
      behavior:      jitter(b, (studentIdx + 1) % 3),
      lessonDate:    new Date('2025-12-31'),
      recordedAt:    new Date('2025-12-31'),
    },
    {
      participation: jitter(p, (studentIdx + 2) % 5),
      uniform:       jitter(u, (studentIdx + 3) % 4),
      behavior:      jitter(b, (studentIdx + 2) % 3),
      lessonDate:    new Date('2026-02-28'),
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
  console.log('\nWiping all existing NormTable rows...');
  await prisma.normTable.deleteMany({});

  console.log('Seeding FitnessTestTypes + NormTables (16 tests, grade-level based)...');
  const testTypeIds = new Map<string, string>();

  for (const config of NORM_CONFIG) {
    // Build all bands for every gender × grade-level group in this test's config
    const bands: NormBandInput[] = [];
    for (const levelGroup of config.gradeLevels) {
      for (const [genderStr, thresholds] of Object.entries(levelGroup.byGender) as [string, import('./norms.config').ScoreThresholds | undefined][]) {
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

    // Validate no overlapping value bands per (gender, gradeLevel) group (BUG-017)
    validateNoBandOverlaps(config.testKey, bands);

    const created = await prisma.fitnessTestType.create({
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
      select: { id: true },
    });

    testTypeIds.set(config.testKey, created.id);
    const totalGrades = config.gradeLevels.reduce((n, g) => n + g.grades.length * Object.keys(g.byGender).length, 0);
    console.log(`  ✓ ${config.nameHe} — ${bands.length} norm bands (${totalGrades} grade/gender combos)`);
  }

  return testTypeIds;
}

async function seedClass(opts: {
  name:         string;
  gradeLabel:   string;
  joinCode:     string;
  teacherId:    string;
  students:     StudentDef[];
  /** Representative age used for formula-based raw value computation. */
  classAge:     number;
  gradeLevel?:  number;
  sessions:     Array<{ testKey: string; date: Date }>;
  testTypeIds:  Map<string, string>;
  passwordHash: string;
}): Promise<string> {
  const {
    name, gradeLabel, joinCode, teacherId,
    students, classAge, gradeLevel, sessions, testTypeIds, passwordHash,
  } = opts;

  const cls = await prisma.class.create({
    data: {
      name,
      academicYear:     '2025-2026',
      joinCode,
      joinCodeExpiresAt: new Date('2099-12-31'),
      teacherId,
      testWeight:       55,
      talmidautWeight:  45,
      ...(gradeLevel !== undefined ? { gradeLevel } : {}),
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
        enrollments: { create: { classId: cls.id, studentCode: def.code } },
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
      // Compute formula-consistent raw value for this student's gender, grade, and tier
      const effectiveGrade = gradeLevel ?? 7;
      const raw = rawForTier(testKey, def.gender, effectiveGrade, def.tier);
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
    lessonDate:    Date;
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
  return cls.id;
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
      school:    'Ben-Gurion Academy',
      googleId:  'dev-google-id-do-not-use-in-prod',
      avatarUrl: null,
    },
    select: { id: true },
  });
  console.log(`  Teacher id=${teacher.id}`);

  const passwordHash = await bcrypt.hash('password123', BCRYPT_ROUNDS);

  console.log("\nSeeding grade-10 class (כיתה י' 1)...");
  const class10Id = await seedClass({
    name:        "כיתה י' 1",
    gradeLabel:  'Grade 10',
    joinCode:    'CLASS10',
    teacherId:   teacher.id,
    students:    STUDENTS_GRADE10,
    classAge:    16, // representative age; norm group 15–18
    gradeLevel:  10,
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
  const class7Id = await seedClass({
    name:        "כיתה ז' 2",
    gradeLabel:  'Grade 7',
    joinCode:    'CLASS7',
    teacherId:   teacher.id,
    students:    STUDENTS_GRADE7,
    classAge:    13, // representative age; norm group 12–14
    gradeLevel:  7,
    sessions: [
      { testKey: 'sprint60', date: new Date('2025-10-15') },
      { testKey: 'pushUps',  date: new Date('2025-11-12') },
      { testKey: 'beepTest', date: new Date('2025-12-10') },
      { testKey: 'situps',   date: new Date('2026-01-14') },
    ],
    testTypeIds,
    passwordHash,
  });

  console.log("\nSeeding grade-2 class (כיתה ב' 1)...");
  const class2Id = await seedClass({
    name:        "כיתה ב' 1",
    gradeLabel:  'Grade 2',
    joinCode:    'CLASS2',
    teacherId:   teacher.id,
    students:    STUDENTS_GRADE2,
    classAge:    7, // representative age; norm group 6–8
    gradeLevel:  2,
    sessions: [
      { testKey: 'run300',   date: new Date('2025-10-15') },
      { testKey: 'situps30', date: new Date('2025-11-12') },
    ],
    testTypeIds,
    passwordHash,
  });

  console.log("\nSeeding grade-4 class (כיתה ד' 1)...");
  const class4Id = await seedClass({
    name:        "כיתה ד' 1",
    gradeLabel:  'Grade 4',
    joinCode:    'CLASS4',
    teacherId:   teacher.id,
    students:    STUDENTS_GRADE4,
    classAge:    9, // representative age; norm group 8–10
    gradeLevel:  4,
    sessions: [
      { testKey: 'run600',   date: new Date('2025-10-15') },
      { testKey: 'situps30', date: new Date('2025-11-12') },
    ],
    testTypeIds,
    passwordHash,
  });

  // ── Schedule entries for TODAY (2026-03-21, Saturday, dayOfWeek=6) ──────────
  // Dev-only: Saturday entries allow testing the dashboard schedule panel today.
  // Times span the day so the service returns a mix of past / now / next / later.
  console.log('\nSeeding today\'s schedule entries (dayOfWeek=6, Saturday)...');
  type ScheduleEntryDelegate = {
    createMany: (args: { data: unknown[] }) => Promise<{ count: number }>;
  };
  const seDelegate = (prisma as unknown as { scheduleEntry: ScheduleEntryDelegate }).scheduleEntry;
  const { count: scheduleCount } = await seDelegate.createMany({
    data: [
      { teacherId: teacher.id, dayOfWeek: 6, period: 0, startTime: '07:30', classId: class10Id },
      { teacherId: teacher.id, dayOfWeek: 6, period: 1, startTime: '10:00', classId: class7Id  },
      { teacherId: teacher.id, dayOfWeek: 6, period: 2, startTime: '13:15', classId: class10Id },
      { teacherId: teacher.id, dayOfWeek: 6, period: 3, startTime: '19:30', classId: class7Id  },
      { teacherId: teacher.id, dayOfWeek: 6, period: 4, startTime: '20:30', classId: class10Id },
    ],
  });
  console.log(`  Schedule entries created: ${scheduleCount}`);

  // Suppress unused variable warnings for elementary class IDs (no schedule entries needed)
  void class2Id;
  void class4Id;

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Seeding complete.');
  console.log('  Dev login:    teacher@test.com  /  /api/auth/dev-login');
  console.log('  Student (10): CLASS10 + 12345 + password123');
  console.log(`  Total test types seeded: ${testTypeIds.size} (16 tests)`);
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
