import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Breakdown of one test type's effective grade for a student. */
export class TestBreakdownDto {
  @ApiProperty() testTypeId!: string;
  @ApiProperty() nameHe!: string;
  @ApiProperty() grade!: number;
}

/** One row in the class final-grades report. Returned by GET /reports/class/:classId. */
export class ReportRowDto {
  @ApiProperty() studentId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() studentCode!: string;

  /** Average of all test effective grades (gradeOverride ?? calculatedGrade). */
  @ApiProperty() fitnessAvg!: number;

  /** talmidautAvg minus (unexcusedAbsences × ABSENCE_PENALTY_PER_DAY), clamped to [0, 100]. */
  @ApiProperty() conductScore!: number;

  /** Effective fitness weight used to compute this row's recommendedFinalGrade (0–100 integer). */
  @ApiProperty() fitnessWeight!: number;

  /** Effective conduct weight used to compute this row's recommendedFinalGrade (0–100 integer). */
  @ApiProperty() conductWeight!: number;

  /** Recommended grade: fitnessAvg × fitnessWeight% + conductScore × conductWeight%, rounded. */
  @ApiProperty() recommendedFinalGrade!: number;

  /** Teacher's persisted override, or null if not yet set. */
  @ApiPropertyOptional({ nullable: true }) teacherFinalGrade!: number | null;

  /** Algorithm-suggested Ministry comment (heuristic). */
  @ApiProperty() suggestedComment!: string;

  /** Teacher's persisted verbal comment, or null if not yet set. */
  @ApiPropertyOptional({ nullable: true }) verbalComment!: string | null;

  /** Number of ABSENT records (not excused). */
  @ApiProperty() unexcusedAbsences!: number;

  /** Total attendance records (PRESENT + ABSENT + EXCUSED). */
  @ApiProperty() totalLessons!: number;

  /** Per-test grade breakdown for column display. */
  @ApiProperty({ type: [TestBreakdownDto] }) testBreakdown!: TestBreakdownDto[];
}
