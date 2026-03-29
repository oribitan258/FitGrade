import { ApiProperty } from '@nestjs/swagger';

export class ComparisonAvailabilityDto {
  @ApiProperty({
    description: 'True if at least one test result exists for Semester B in this class',
  })
  hasSemesterBData!: boolean;
}

export class StudentComparisonGradeDto {
  @ApiProperty()
  studentId!: string;

  @ApiProperty({
    description: 'Average effective grade (0–100) across all sessions for this test in this semester',
  })
  effectiveGrade!: number;
}

export class ComparisonGradeDistributionDto {
  @ApiProperty({ description: 'Count of students with effective grade ≥ 90' })
  excellent!: number;

  @ApiProperty({ description: 'Count of students with effective grade 75–89' })
  good!: number;

  @ApiProperty({ description: 'Count of students with effective grade 60–74' })
  pass!: number;

  @ApiProperty({ description: 'Count of students with effective grade < 60' })
  fail!: number;
}

export class SemesterTestDataDto {
  @ApiProperty({ description: 'Class average effective grade (0–100) for this test in this semester' })
  classAvg!: number;

  @ApiProperty({ type: ComparisonGradeDistributionDto })
  distribution!: ComparisonGradeDistributionDto;

  @ApiProperty({ type: [StudentComparisonGradeDto] })
  studentGrades!: StudentComparisonGradeDto[];
}

export class TestComparisonDto {
  @ApiProperty()
  testTypeId!: string;

  @ApiProperty()
  nameHe!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Measurement unit (e.g. "שניות", "חזרות"), or null',
  })
  unit!: string | null;

  @ApiProperty({
    type: SemesterTestDataDto,
    nullable: true,
    description: 'null when this test was never conducted in Semester A',
  })
  semesterA!: SemesterTestDataDto | null;

  @ApiProperty({
    type: SemesterTestDataDto,
    nullable: true,
    description: 'null when this test has not yet been conducted in Semester B',
  })
  semesterB!: SemesterTestDataDto | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'semesterB.classAvg − semesterA.classAvg; null when either semester is missing',
  })
  deltaClassAvg!: number | null;
}

export class ClassComparisonResponseDto {
  @ApiProperty({ type: [TestComparisonDto] })
  testComparisons!: TestComparisonDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Average of all per-test class averages in Semester A; null if no Semester A data',
  })
  classAverageA!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Average of all per-test class averages in Semester B; null if no Semester B data',
  })
  classAverageB!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'classAverageB − classAverageA; null when either overall average is missing',
  })
  deltaClassAverage!: number | null;
}
