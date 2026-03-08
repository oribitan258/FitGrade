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

  @ApiProperty({ description: 'Effective grade of the most recent session (0–100)' })
  latestGrade!: number;

  @ApiProperty({ type: [StudentHistoryPointDto], description: 'All sessions ordered by date (oldest first)' })
  history!: StudentHistoryPointDto[];
}

export class StudentProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  dateOfBirth!: Date;

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
}
