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

  @ApiProperty({ description: 'Students missing a result for at least one existing session' })
  pendingResultsCount!: number;

  @ApiProperty({ type: [DashboardClassStatDto] })
  classStats!: DashboardClassStatDto[];

  @ApiProperty({ type: [RecentSessionDto], description: 'Up to 5 most recent test sessions' })
  recentSessions!: RecentSessionDto[];
}

export class MissingResultItemDto {
  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  studentName!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  testNameHe!: string;

  @ApiProperty({ description: 'ISO 8601 date string of the session' })
  sessionDate!: string;
}

export class BelowNormItemDto {
  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  studentName!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty()
  testNameHe!: string;

  @ApiProperty({ description: 'The student\'s calculatedGrade (0–100)' })
  score!: number;

  @ApiProperty({ description: 'The norm threshold the student fell below' })
  normThreshold!: number;
}

export class TopAchievementItemDto {
  @ApiProperty({ description: 'Rank position starting at 1' })
  rank!: number;

  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  studentName!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty({ description: 'Gender composition of the class: BOYS | GIRLS | MIXED' })
  classGenderType!: string;

  @ApiProperty({ description: 'Hebrew name of the specific exam (e.g. "ריצת 2000מ׳")' })
  examName!: string;

  @ApiProperty({ description: 'Unit label (e.g. "שניות", "מטר") — null for REPS/PASS_FAIL', nullable: true })
  unit!: string | null;

  @ApiProperty({ description: 'Raw measurement value (seconds, reps, etc.) — null if not recorded', nullable: true })
  rawValue!: number | null;

  @ApiProperty({ description: 'calculatedGrade for this result (0–100)' })
  score!: number;
}

export class TopStudentPerClassItemDto {
  @ApiProperty({ description: 'Rank within the class: 1, 2, or 3' })
  rank!: number;

  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  studentName!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty({ description: 'Average calculatedGrade across all results in this class (0–100)' })
  avgScore!: number;
}

export class TopStudentItemDto {
  @ApiProperty({ description: 'Rank position starting at 1' })
  rank!: number;

  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  studentName!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty({ description: 'Average calculatedGrade across all recorded results (0–100)' })
  avgGrade!: number;

  @ApiProperty({ description: 'Number of test results recorded for this student' })
  resultCount!: number;

  @ApiProperty({ description: 'Student gender: MALE | FEMALE | OTHER' })
  gender!: string;
}

export class MonthlyClassAverageDto {
  @ApiProperty({ description: 'Calendar month in "YYYY-MM" format — use as chart X-axis key', example: '2025-10' })
  month!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  className!: string;

  @ApiProperty({ description: 'Rounded average grade for this class in this month (0–100)' })
  avg!: number;
}
