import { ApiProperty } from '@nestjs/swagger';

export class DashboardClassStatDto {
  @ApiProperty()
  classId!: string;

  @ApiProperty({ description: 'Average calculatedGrade across all results in this class (0 if no results)' })
  fitnessAvg!: number;

  @ApiProperty({ description: 'Percentage of PRESENT attendance records (0–100)' })
  attendancePct!: number;

  @ApiProperty({ description: 'Students whose average grade is below the PASS threshold (57)' })
  belowNormCount!: number;
}

export class RecentSessionDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty()
  testNameHe!: string;

  @ApiProperty({ description: 'ISO 8601 date string' })
  conductedAt!: string;
}

export class DashboardStatsResponseDto {
  @ApiProperty({ description: 'Average calculatedGrade across all teacher classes (0 if no results)' })
  overallFitnessAvg!: number;

  @ApiProperty({ description: 'Percentage of PRESENT attendance records across all classes' })
  overallAttendancePct!: number;

  @ApiProperty({ description: 'Students with average grade below PASS threshold (57) across all classes' })
  totalBelowNormCount!: number;

  @ApiProperty({ description: 'Total enrolled students across all classes' })
  totalStudents!: number;

  @ApiProperty({ description: 'Results not yet submitted: expected (sessions × enrollments) minus actual results' })
  pendingResultsCount!: number;

  @ApiProperty({ type: [DashboardClassStatDto] })
  classStats!: DashboardClassStatDto[];

  @ApiProperty({ type: [RecentSessionDto], description: 'Up to 5 most recent test sessions' })
  recentSessions!: RecentSessionDto[];
}
