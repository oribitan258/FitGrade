import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FitnessInputType, Gender, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Minimal student data required for grade calculation. */
export interface StudentForGrading {
  gender: Gender;
}

/**
 * In-memory band representation. We pre-convert minValue/maxValue from
 * Prisma.Decimal to number once at load time so the hot-path lookup is a
 * plain numeric comparison instead of a Decimal method call per band.
 *
 * Test values (seconds, reps, meters) are well within JS number precision —
 * the Decimal type in the schema exists for DB storage, not for arithmetic
 * here.
 */
interface NormBand {
  minValue: number;
  maxValue: number;
  score: number;
}

@Injectable()
export class GradingRepository implements OnModuleInit {
  private readonly logger = new Logger(GradingRepository.name);

  // Cache keyed by `${testTypeId}|${gender}|${gradeLevel}` → bands sorted asc by minValue.
  // NormTable is system-seeded and read-only — see docs/database-schema.md.
  // Invalidate via refresh() after re-seeding (no public endpoint yet; restart works too).
  private normCache = new Map<string, NormBand[]>();

  // FitnessTestType.inputType is fixed per test type (≤25 rows globally).
  private testTypeCache = new Map<string, FitnessInputType>();

  private cacheLoaded = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  /**
   * Loads NormTable + FitnessTestType.inputType into memory. Safe to call
   * multiple times — each call replaces the previous cache atomically.
   */
  async refresh(): Promise<void> {
    const [normRows, testTypes] = await Promise.all([
      this.prisma.normTable.findMany({
        select: {
          testTypeId: true,
          gender: true,
          gradeLevel: true,
          minValue: true,
          maxValue: true,
          score: true,
        },
      }),
      this.prisma.fitnessTestType.findMany({
        select: { id: true, inputType: true },
      }),
    ]);

    const nextNorm = new Map<string, NormBand[]>();
    for (const row of normRows) {
      const key = this.normKey(row.testTypeId, row.gender, row.gradeLevel);
      const list = nextNorm.get(key);
      const band: NormBand = {
        minValue: row.minValue.toNumber(),
        maxValue: row.maxValue.toNumber(),
        score: row.score,
      };
      if (list) list.push(band);
      else nextNorm.set(key, [band]);
    }
    for (const list of nextNorm.values()) {
      list.sort((a, b) => a.minValue - b.minValue);
    }

    const nextTestType = new Map<string, FitnessInputType>();
    for (const t of testTypes) nextTestType.set(t.id, t.inputType);

    this.normCache = nextNorm;
    this.testTypeCache = nextTestType;
    this.cacheLoaded = true;
    this.logger.log(
      `Grading cache loaded: ${normRows.length} norm rows across ${nextNorm.size} (test,gender,grade) groups, ${testTypes.length} test types`,
    );
  }

  private normKey(testTypeId: string, gender: Gender, gradeLevel: number): string {
    return `${testTypeId}|${gender}|${gradeLevel}`;
  }

  /**
   * Fetches only the fields needed for grade calculation.
   * Throws NotFoundException if the student does not exist.
   * Never returns passwordHash.
   */
  async findStudentById(studentId: string): Promise<StudentForGrading> {
    return this.prisma.student.findFirstOrThrow({
      where: { id: studentId, deletedAt: null },
      select: {
        gender: true,
      },
    });
  }

  /** Returns the gradeLevel of a class. Returns null if class has no gradeLevel set. */
  async findClassGradeLevel(classId: string): Promise<number | null> {
    const cls = await this.prisma.class.findUniqueOrThrow({
      where: { id: classId },
      select: { gradeLevel: true },
    });
    return cls.gradeLevel;
  }

  /** Returns the inputType of a test type. Throws NotFoundException if not found. */
  async findTestTypeInputType(
    testTypeId: string,
  ): Promise<{ inputType: FitnessInputType }> {
    if (this.cacheLoaded) {
      const cached = this.testTypeCache.get(testTypeId);
      if (cached !== undefined) return { inputType: cached };
    }
    // Cold-start fallback (or unknown id seeded after boot): hit the DB and
    // populate the cache so the next call is fast.
    const row = await this.prisma.fitnessTestType.findUniqueOrThrow({
      where: { id: testTypeId },
      select: { inputType: true },
    });
    this.testTypeCache.set(testTypeId, row.inputType);
    return row;
  }

  /**
   * Resolves the NormTable score for a given rawValue using the three-step
   * lookup with boundary clamping. (LOGIC-001)
   *
   * Band semantics: minValue ≤ rawValue < maxValue (minValue inclusive,
   * maxValue exclusive). Bands are pre-sorted ascending by minValue at
   * cache load time so a single linear pass implements all three steps:
   *
   *   - Step 1 — exact band: minValue ≤ rawValue < maxValue.
   *   - Step 2 — above all bands (rawValue ≥ every maxValue): the last band
   *     visited whose minValue ≤ rawValue. That's the highest-minValue band
   *     still in range — same semantics as the previous DB query
   *     `orderBy: { minValue: 'desc' }` + `where: { minValue: { lte: rawValue } }`.
   *   - Step 3 — below all bands (rawValue < every minValue): the first
   *     band in the sorted list, which has the lowest minValue.
   *
   * Returns null ONLY when no bands are seeded for this (testTypeId, gender,
   * gradeLevel) combination — a genuine configuration gap. The service then
   * throws BadRequestException so the teacher knows the norm table is missing.
   *
   * Why in-memory: NormTable is system-seeded and queried up to 3× per
   * test result. For a 30-student class session that's ~90 round-trips on
   * the hot path. We trade ~50KB of RAM for those round-trips.
   */
  async findNormRow(
    testTypeId: string,
    gender: Gender,
    gradeLevel: number,
    rawValue: Prisma.Decimal,
  ): Promise<{ score: number } | null> {
    if (!this.cacheLoaded) {
      // Defensive: should never happen because OnModuleInit runs before any
      // controller mounts, but guarantee correctness if someone constructs
      // the service in a test without going through the Nest lifecycle.
      await this.refresh();
    }

    const bands = this.normCache.get(this.normKey(testTypeId, gender, gradeLevel));
    if (bands === undefined || bands.length === 0) return null;

    const raw = rawValue.toNumber();

    // Single pass: capture step-1 match if found; otherwise remember the
    // last band whose minValue ≤ raw (step 2). If we never enter the loop
    // body (raw < bands[0].minValue), fall through to step 3.
    let stepTwo: NormBand | null = null;
    for (const band of bands) {
      if (band.minValue > raw) break;
      if (band.maxValue > raw) {
        // Step 1: exact band.
        return { score: band.score };
      }
      stepTwo = band;
    }

    if (stepTwo !== null) return { score: stepTwo.score };

    // Step 3: rawValue < minValue of every band → lowest-minValue band.
    return { score: bands[0]!.score };
  }
}
