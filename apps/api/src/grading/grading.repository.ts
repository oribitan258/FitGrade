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
   * Finds the NormTable row whose band contains the given rawValue for the
   * student's gradeLevel/gender, returning the score (0–100).
   *
   * Returns null when no norm row is configured for this combination — the
   * service treats this as a BadRequestException.
   *
   * Band semantics:  minValue ≤ rawValue < maxValue  (minValue inclusive, maxValue exclusive)
   */
  async findNormRow(
    testTypeId: string,
    gender: Gender,
    gradeLevel: number,
    rawValue: Prisma.Decimal,
  ): Promise<{ score: number } | null> {
    return this.prisma.normTable.findFirst({
      where: {
        testTypeId,
        gender,
        gradeLevel,
        minValue: { lte: rawValue },
        maxValue: { gt: rawValue },
      },
      select: { score: true },
    });
  }
}
