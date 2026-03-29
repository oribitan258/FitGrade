import { Injectable } from '@nestjs/common';
import { ClassesRepository } from '../classes/classes.repository';
import { ComparisonRepository } from './comparison.repository';
import type { RawComparisonResult } from './comparison.repository';
import type {
  ClassComparisonResponseDto,
  ComparisonAvailabilityDto,
  ComparisonGradeDistributionDto,
  SemesterTestDataDto,
  StudentComparisonGradeDto,
  TestComparisonDto,
} from './dto/comparison.dto';

/** Grade thresholds consistent with the gradeLevel() function used on the frontend. */
const GRADE_EXCELLENT = 90;
const GRADE_GOOD      = 75;
const GRADE_PASS      = 60;

/** Running totals for averaging a student's grade across multiple sessions. */
interface StudentAccumulator {
  sum: number;
  count: number;
}

interface TestAccumulator {
  nameHe: string;
  unit: string | null;
  /** Per-student grade accumulators for Semester A results. */
  studentsA: Map<string, StudentAccumulator>;
  /** Per-student grade accumulators for Semester B results. */
  studentsB: Map<string, StudentAccumulator>;
}

/** Buckets a list of numeric grades into the four-level distribution shape. */
function buildGradeDistribution(grades: number[]): ComparisonGradeDistributionDto {
  const dist: ComparisonGradeDistributionDto = { excellent: 0, good: 0, pass: 0, fail: 0 };
  for (const g of grades) {
    if (g >= GRADE_EXCELLENT)      dist.excellent++;
    else if (g >= GRADE_GOOD)      dist.good++;
    else if (g >= GRADE_PASS)      dist.pass++;
    else                           dist.fail++;
  }
  return dist;
}

/**
 * Converts a per-student accumulator map into a SemesterTestDataDto.
 * Returns null if the map is empty (test never conducted in that semester).
 */
function buildSemesterTestData(
  students: Map<string, StudentAccumulator>,
): SemesterTestDataDto | null {
  if (students.size === 0) return null;

  const studentGrades: StudentComparisonGradeDto[] = [...students.entries()].map(
    ([studentId, { sum, count }]) => ({
      studentId,
      effectiveGrade: count > 0 ? Math.round(sum / count) : 0,
    }),
  );

  const classAvg = Math.round(
    studentGrades.reduce((s, sg) => s + sg.effectiveGrade, 0) / studentGrades.length,
  );

  return {
    classAvg,
    distribution: buildGradeDistribution(studentGrades.map((sg) => sg.effectiveGrade)),
    studentGrades,
  };
}

/**
 * Accumulates effective grades from a flat result array into the per-test
 * accumulator map. Identified by `targetSemesterKey` to direct the grade
 * into either `studentsA` or `studentsB`.
 */
function accumulateResults(
  results: RawComparisonResult[],
  testMap: Map<string, TestAccumulator>,
  semesterKey: 'studentsA' | 'studentsB',
): void {
  for (const result of results) {
    const { testTypeId, testType } = result.session;
    const effectiveGrade = result.gradeOverride ?? result.calculatedGrade ?? 0;

    if (!testMap.has(testTypeId)) {
      testMap.set(testTypeId, {
        nameHe: testType.nameHe,
        unit: testType.unit,
        studentsA: new Map(),
        studentsB: new Map(),
      });
    }

    const acc = testMap.get(testTypeId)!;
    const targetMap = acc[semesterKey];
    const prev = targetMap.get(result.studentId) ?? { sum: 0, count: 0 };
    prev.sum += effectiveGrade;
    prev.count++;
    targetMap.set(result.studentId, prev);
  }
}

@Injectable()
export class ComparisonService {
  constructor(
    private readonly comparisonRepository: ComparisonRepository,
    private readonly classesRepository: ClassesRepository,
  ) {}

  /**
   * Lightweight availability check — verifies ownership then counts Semester B results.
   * The frontend uses this to enable/disable the comparison button.
   */
  async getAvailability(
    classId: string,
    teacherId: string,
  ): Promise<ComparisonAvailabilityDto> {
    await this.classesRepository.findOneByIdAndTeacher(classId, teacherId);
    const hasSemesterBData = await this.comparisonRepository.hasSemesterBData(classId);
    return { hasSemesterBData };
  }

  /**
   * Returns the full semester A vs B comparison for a class.
   *
   * Two Prisma queries (one per semester) run in parallel. Aggregation is done
   * entirely in-memory. Tests with no results in either semester are excluded.
   * `deltaClassAvg` is null whenever either semester lacks data for that test.
   */
  async getComparison(
    classId: string,
    teacherId: string,
  ): Promise<ClassComparisonResponseDto> {
    await this.classesRepository.findOneByIdAndTeacher(classId, teacherId);

    const { semA, semB } = await this.comparisonRepository.findRawResults(classId);

    // ── Accumulate per-student grades per test type per semester ──────────────
    const testMap = new Map<string, TestAccumulator>();
    accumulateResults(semA, testMap, 'studentsA');
    accumulateResults(semB, testMap, 'studentsB');

    // ── Build TestComparisonDto[] and collect per-semester class averages ─────
    const testComparisons: TestComparisonDto[] = [];
    const semAAvgs: number[] = [];
    const semBAvgs: number[] = [];

    for (const [testTypeId, acc] of testMap.entries()) {
      const semesterA = buildSemesterTestData(acc.studentsA);
      const semesterB = buildSemesterTestData(acc.studentsB);

      // Exclude tests with no results in either semester (should not occur in practice)
      if (semesterA === null && semesterB === null) continue;

      const deltaClassAvg =
        semesterA !== null && semesterB !== null
          ? semesterB.classAvg - semesterA.classAvg
          : null;

      if (semesterA !== null) semAAvgs.push(semesterA.classAvg);
      if (semesterB !== null) semBAvgs.push(semesterB.classAvg);

      testComparisons.push({
        testTypeId,
        nameHe: acc.nameHe,
        unit: acc.unit,
        semesterA,
        semesterB,
        deltaClassAvg,
      });
    }

    // ── Overall class averages (mean of all per-test class averages) ──────────
    const classAverageA =
      semAAvgs.length > 0
        ? Math.round(semAAvgs.reduce((s, a) => s + a, 0) / semAAvgs.length)
        : null;

    const classAverageB =
      semBAvgs.length > 0
        ? Math.round(semBAvgs.reduce((s, a) => s + a, 0) / semBAvgs.length)
        : null;

    const deltaClassAverage =
      classAverageA !== null && classAverageB !== null
        ? classAverageB - classAverageA
        : null;

    return { testComparisons, classAverageA, classAverageB, deltaClassAverage };
  }
}
