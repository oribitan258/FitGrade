import { Injectable } from '@nestjs/common';
import { FitnessInputType, Gender, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Minimal student data required for grade calculation. */
export interface StudentForGrading {
  gender: Gender;
}

@Injectable()
export class GradingRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.fitnessTestType.findUniqueOrThrow({
      where: { id: testTypeId },
      select: { inputType: true },
    });
  }

  /**
   * Finds the NormTable score for a given rawValue using a three-step lookup
   * with boundary clamping so out-of-range performers always receive a grade.
   * (LOGIC-001)
   *
   * Band semantics: minValue ≤ rawValue < maxValue (minValue inclusive, maxValue exclusive)
   *
   * Step 1 — Exact match: rawValue falls within a configured band. Fast path.
   *
   * Step 2 — Above all bands: rawValue ≥ maxValue of the top band (e.g., a
   *   sprinter who beats the fastest time in the norm table). We pick the band
   *   with the highest minValue that is still ≤ rawValue. For TIME tests this
   *   is the fastest band (highest score); for REPS tests this is the most-reps
   *   band (highest score). Both cases correctly award the best grade.
   *
   * Step 3 — Below all bands: rawValue < minValue of every band (e.g., a student
   *   who is slower than any seeded norm row). We pick the band with the lowest
   *   minValue, which is the "weakest performer" band for both test types.
   *
   * Returns null ONLY when no bands are seeded for this (testTypeId, gender,
   * gradeLevel) combination — a genuine configuration gap. The service then
   * throws BadRequestException so the teacher knows the norm table is missing.
   */
  async findNormRow(
    testTypeId: string,
    gender: Gender,
    gradeLevel: number,
    rawValue: Prisma.Decimal,
  ): Promise<{ score: number } | null> {
    const base = { testTypeId, gender, gradeLevel } as const;

    // Step 1: exact band [minValue, maxValue)
    const exact = await this.prisma.normTable.findFirst({
      where: { ...base, minValue: { lte: rawValue }, maxValue: { gt: rawValue } },
      select: { score: true },
    });
    if (exact !== null) return exact;

    // Step 2: rawValue ≥ maxValue of the top band — clamp to the band whose
    // minValue is the highest value still ≤ rawValue.
    const clampHigh = await this.prisma.normTable.findFirst({
      where: { ...base, minValue: { lte: rawValue } },
      orderBy: { minValue: 'desc' },
      select: { score: true },
    });
    if (clampHigh !== null) return clampHigh;

    // Step 3: rawValue < minValue of every band — clamp to the lowest-boundary band.
    return this.prisma.normTable.findFirst({
      where: base,
      orderBy: { minValue: 'asc' },
      select: { score: true },
    });
  }
}
