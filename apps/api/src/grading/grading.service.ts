import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FitnessInputType, Gender, Prisma } from '@prisma/client';
import { GradingRepository } from './grading.repository';

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(private readonly gradingRepository: GradingRepository) {}

  /**
   * Calculates the grade (0–100) for a single test result.
   *
   * 1. Fetches the student's gender and date of birth.
   * 2. Computes the student's age at the session date (not today).
   * 3. Looks up the NormTable row that matches (testType, gender, age, rawValue).
   * 4. Returns the score, or throws NotFoundException when no norm row covers
   *    the given combination.
   *
   * This is the ONLY place in the codebase that performs grade calculation.
   * No other service or controller may replicate this logic.
   *
   * @param studentId  - ID of the student whose result is being graded
   * @param testTypeId - ID of the FitnessTestType being performed
   * @param rawValue   - Raw measurement (seconds for TIME, reps for REPS, etc.)
   * @returns Score 0–100 as stored in the matching NormTable row
   */
  async calculateGrade(
    studentId: string,
    testTypeId: string,
    rawValue: number,
    sessionDate: Date,
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

    const age = this.computeAge(student.dateOfBirth, sessionDate);

    const rawValueDecimal = new Prisma.Decimal(rawValue);

    const normRow = await this.gradingRepository.findNormRow(
      testTypeId,
      student.gender,
      age,
      rawValueDecimal,
    );

    if (normRow === null) {
      this.logger.warn(
        `No norm row found for testTypeId=${testTypeId}, gender=${student.gender}, age=${age}, rawValue=${rawValue}`,
      );
      throw new NotFoundException(
        `לא נמצאה טבלת נורמות עבור בדיקה זו (גיל ${age}, ${student.gender})`,
      );
    }

    this.logger.log(
      `Graded student=${studentId} test=${testTypeId} rawValue=${rawValue} → score=${normRow.score}`,
    );

    return normRow.score;
  }

  /**
   * Computes completed years of age between dateOfBirth and referenceDate.
   * Pure function — no external dependencies — kept here so tests can exercise
   * it via the service without DB involvement.
   *
   * @internal Exposed as package-private for testing purposes.
   */
  /** Returns the gender of a student for external validation. */
  async getStudentGender(studentId: string): Promise<Gender> {
    const student = await this.gradingRepository.findStudentById(studentId);
    return student.gender;
  }

  computeAge(dateOfBirth: Date, referenceDate: Date): number {
    const birthYear = dateOfBirth.getFullYear();
    const birthMonth = dateOfBirth.getMonth(); // 0-indexed
    const birthDay = dateOfBirth.getDate();

    const refYear = referenceDate.getFullYear();
    const refMonth = referenceDate.getMonth();
    const refDay = referenceDate.getDate();

    let age = refYear - birthYear;

    // If the birthday hasn't occurred yet this calendar year, subtract one
    if (
      refMonth < birthMonth ||
      (refMonth === birthMonth && refDay < birthDay)
    ) {
      age -= 1;
    }

    return age;
  }
}
