import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProgressPointDto {
  @ApiProperty({ description: "Hebrew month label, e.g. \"אוק'\"" })
  month!: string;

  @ApiProperty({ description: 'Average effectiveGrade for this session (0–100)' })
  classAvg!: number;
}

export class GradeDistributionDto {
  @ApiProperty({ description: 'Students with average grade ≥ 90' })
  excellent!: number;

  @ApiProperty({ description: 'Students with average grade 75–89' })
  good!: number;

  @ApiProperty({ description: 'Students with average grade 60–74' })
  pass!: number;

  @ApiProperty({ description: 'Students with average grade < 60' })
  fail!: number;
}

export class StudentGradeDto {
  @ApiProperty()
  studentId!: string;

  @ApiProperty({ description: 'gradeOverride ?? calculatedGrade, averaged across sessions of this test type' })
  effectiveGrade!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Raw measurement value from the most recent session (seconds, reps, etc.)' })
  rawValue!: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Teacher override from the most recent session; null = never overridden or explicitly cleared' })
  gradeOverride!: number | null;
}

export class TestSummaryDto {
  @ApiProperty()
  testTypeId!: string;

  @ApiProperty({ description: 'Hebrew test name, e.g. "ריצת 2000 מטר"' })
  nameHe!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Hebrew unit label, e.g. "שניות"' })
  unit!: string | null;

  @ApiProperty({ type: [ProgressPointDto], description: 'One point per session ordered by date' })
  progressData!: ProgressPointDto[];

  @ApiProperty({ type: GradeDistributionDto })
  distribution!: GradeDistributionDto;

  @ApiProperty({ type: [StudentGradeDto], description: 'One entry per student (avg across sessions)' })
  studentGrades!: StudentGradeDto[];
}

export class ClassDetailsResponseDto {
  @ApiProperty({ description: 'Percentage of PRESENT attendance records for this class (0–100)' })
  attendancePct!: number;

  @ApiProperty({ type: [TestSummaryDto] })
  testSummaries!: TestSummaryDto[];
}
