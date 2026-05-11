import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StudentHistoryPointDto {
  @ApiProperty({ description: "Hebrew month label, e.g. \"אוק'\"" })
  month!: string;

  @ApiProperty({ description: 'Effective grade for this student in this session (0–100)' })
  grade!: number;
}

export class StudentTestHistoryDto {
  @ApiProperty()
  testTypeId!: string;

  @ApiProperty({ description: 'Hebrew test name, e.g. "ריצת 2000 מטר"' })
  nameHe!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Hebrew unit label, e.g. "שניות"' })
  unit!: string | null;

  @ApiProperty({ description: 'Input type for the test: TIME | REPS | PASS_FAIL | GENERAL' })
  inputType!: string;

  @ApiProperty({ description: 'Effective grade of the most recent session (0–100)' })
  latestGrade!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Raw measurement value of the most recent session (seconds, reps, etc.)' })
  latestRawValue!: number | null;

  @ApiProperty({ type: [StudentHistoryPointDto], description: 'All sessions ordered by date (oldest first)' })
  history!: StudentHistoryPointDto[];
}

export class TalmidautRecordDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'ציון השתתפות (0–100)' })
  participation!: number;

  @ApiProperty({ description: 'ציון לבוש (0–100)' })
  uniform!: number;

  @ApiProperty({ description: 'ציון התנהגות (0–100)' })
  behavior!: number;

  @ApiProperty({ description: 'ממוצע שלושת הרכיבים: (השתתפות + לבוש + התנהגות) / 3' })
  compositeScore!: number;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  recordedAt!: string;
}

export class FinalGradeDto {
  @ApiProperty({ description: 'ממוצע ציוני מבחני הכושר (0–100)' })
  fitnessAvg!: number;

  @ApiProperty({ description: 'ממוצע ציוני התלמידאות (0–100)' })
  talmidautAvg!: number;

  @ApiProperty({ description: 'הציון הסופי המומלץ (0–100)' })
  recommendedGrade!: number;

  @ApiProperty({ description: 'משקל מבחני הכושר בכיתה (0–100)' })
  testWeight!: number;

  @ApiProperty({ description: 'משקל התלמידאות בכיתה (0–100)' })
  talmidautWeight!: number;
}

export class StudentProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ nullable: true })
  dateOfBirth!: Date | null;

  @ApiProperty()
  gender!: string;

  @ApiProperty()
  studentCode!: string;

  @ApiProperty({ description: 'Percentage of PRESENT attendance records for this student in this class (0–100)' })
  attendancePct!: number;

  @ApiProperty({
    type: [Number],
    description: 'Last ≤6 attendance values in chronological order: 100 = present, 0 = absent/late/excused',
  })
  attendanceTrend!: number[];

  @ApiProperty({ description: 'Average of latestGrade across all test types (0 if no results)' })
  overallAvg!: number;

  @ApiProperty({ type: [StudentTestHistoryDto] })
  testHistories!: StudentTestHistoryDto[];

  @ApiProperty({ type: [TalmidautRecordDto], description: 'All talmidaut records for this student in this class, newest first' })
  talmidautRecords!: TalmidautRecordDto[];

  @ApiProperty({ type: FinalGradeDto, description: 'Recommended final grade breakdown' })
  finalGrade!: FinalGradeDto;
}
