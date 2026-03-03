import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Gender } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Minimal student data required for grade calculation. */
export interface StudentForGrading {
  gender: Gender;
  dateOfBirth: Date;
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
    return this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      select: {
        gender: true,
        dateOfBirth: true,
      },
    });
  }

  /**
   * Finds the NormTable row whose band contains the given rawValue for the
   * student's age/gender, returning the score (0–100).
   *
   * Returns null when no norm row is configured for this combination — the
   * service treats this as a NotFoundException.
   *
   * Band semantics:  minValue ≤ rawValue < maxValue  (minValue inclusive, maxValue exclusive)
   */
  async findNormRow(
    testTypeId: string,
    gender: Gender,
    age: number,
    rawValue: Prisma.Decimal,
  ): Promise<{ score: number } | null> {
    return this.prisma.normTable.findFirst({
      where: {
        testTypeId,
        gender,
        minAge: { lte: age },
        maxAge: { gte: age },
        minValue: { lte: rawValue },
        maxValue: { gt: rawValue },
      },
      select: { score: true },
    });
  }
}
