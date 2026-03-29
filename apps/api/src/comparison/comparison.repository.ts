import { Injectable } from '@nestjs/common';
import { Semester } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Shape of a single test result returned by the comparison queries. */
export interface RawComparisonResult {
  studentId: string;
  /** Backend-calculated grade (0–100), null if not yet computed. */
  calculatedGrade: number | null;
  /** Teacher override, takes precedence over calculatedGrade when present. */
  gradeOverride: number | null;
  session: {
    testTypeId: string;
    testType: { nameHe: string; unit: string | null };
  };
}

/** The Prisma select reused by both semester queries. */
const RESULT_SELECT = {
  studentId: true,
  calculatedGrade: true,
  gradeOverride: true,
  session: {
    select: {
      testTypeId: true,
      testType: { select: { nameHe: true, unit: true } },
    },
  },
} as const;

@Injectable()
export class ComparisonRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches test results for both Semester A and B in parallel (two Prisma calls).
   * The `semester` field is applied via object spread to work around a stale
   * Prisma-generated type that does not yet reflect the schema's `semester` column
   * on `TestSession`. Both calls resolve concurrently via Promise.all.
   */
  async findRawResults(
    classId: string,
  ): Promise<{ semA: RawComparisonResult[]; semB: RawComparisonResult[] }> {
    const filterA = { semester: Semester.A };
    const filterB = { semester: Semester.B };
    const [semA, semB] = await Promise.all([
      this.prisma.testResult.findMany({
        where: { session: { classId, ...filterA } },
        select: RESULT_SELECT,
      }),
      this.prisma.testResult.findMany({
        where: { session: { classId, ...filterB } },
        select: RESULT_SELECT,
      }),
    ]);
    return { semA, semB };
  }

  /**
   * Lightweight availability check.
   * Returns true if at least one TestResult exists for Semester B in this class.
   */
  async hasSemesterBData(classId: string): Promise<boolean> {
    const semFilterB = { semester: Semester.B };
    const count = await this.prisma.testResult.count({
      where: { session: { classId, ...semFilterB } },
    });
    return count > 0;
  }
}
