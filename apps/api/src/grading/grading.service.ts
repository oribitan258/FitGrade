import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FitnessInputType, Gender, Prisma } from '@prisma/client';
import { GradingRepository } from './grading.repository';

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(private readonly gradingRepository: GradingRepository) {}

  /**
   * Calculates the grade (0–100) for a single test result.
   *
   * 1. Fetches the test type's inputType.
   * 2. For PASS_FAIL: rawValue ≥ 1 → 100, else 0. No norm lookup.
   * 3. For all other types: fetches the student's gender and the class's gradeLevel,
   *    then looks up the NormTable row matching (testType, gender, gradeLevel, rawValue band).
   * 4. Throws BadRequestException when no norm row covers the combination — exposed
   *    in Hebrew to the teacher as a safe, actionable message.
   *
   * This is the ONLY place in the codebase that performs grade calculation.
   * No other service or controller may replicate this logic.
   *
   * @param studentId  - ID of the student whose result is being graded
   * @param testTypeId - ID of the FitnessTestType being performed
   * @param rawValue   - Raw measurement (seconds for TIME, reps for REPS, etc.)
   * @param classId    - ID of the class (used to look up gradeLevel for norm selection)
   */
  async calculateGrade(
    studentId: string,
    testTypeId: string,
    rawValue: number,
    classId: string,
  ): Promise<number> {
    const { inputType } =
      await this.gradingRepository.findTestTypeInputType(testTypeId);

    // PASS_FAIL tests have no norm table — rawValue 1 = pass (100), 0 = fail (0).
    if (inputType === FitnessInputType.PASS_FAIL) {
      const score = rawValue >= 1 ? 100 : 0;
      this.logger.log(
        `Graded student=${studentId} test=${testTypeId} PASS_FAIL rawValue=${rawValue} → score=${score}`,
      );
      return score;
    }

    const student = await this.gradingRepository.findStudentById(studentId);
    const gradeLevel = await this.gradingRepository.findClassGradeLevel(classId);

    if (gradeLevel === null) {
      throw new BadRequestException(
        'אין נתוני נורמה תואמים למבחן זה עבור שכבת גיל ומגדר אלו.',
      );
    }

    const rawValueDecimal = new Prisma.Decimal(rawValue);

    const normRow = await this.gradingRepository.findNormRow(
      testTypeId,
      student.gender,
      gradeLevel,
      rawValueDecimal,
    );

    if (normRow === null) {
      this.logger.warn(
        `No norm row found for testTypeId=${testTypeId}, gender=${student.gender}, gradeLevel=${gradeLevel}, rawValue=${rawValue}`,
      );
      throw new BadRequestException(
        'אין נתוני נורמה תואמים למבחן זה עבור שכבת גיל ומגדר אלו.',
      );
    }

    this.logger.log(
      `Graded student=${studentId} test=${testTypeId} gradeLevel=${gradeLevel} rawValue=${rawValue} → score=${normRow.score}`,
    );

    return normRow.score;
  }

  /** Returns the gender of a student for external validation. */
  async getStudentGender(studentId: string): Promise<Gender> {
    const student = await this.gradingRepository.findStudentById(studentId);
    return student.gender;
  }
}
