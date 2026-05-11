import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FitnessInputType } from '@prisma/client';

export class LiveStudentResultDto {
  @ApiProperty({ description: 'TestResult row ID' })
  resultId!: string;

  @ApiProperty()
  studentId!: string;

  @ApiProperty({ description: 'Raw measurement submitted by teacher (seconds, reps, etc.)' })
  rawValue!: number;

  @ApiProperty({ description: 'Grade 0–100 calculated by GradingService' })
  calculatedGrade!: number;

  @ApiPropertyOptional({ nullable: true })
  gradeOverride!: number | null;

  @ApiProperty()
  recordedAt!: Date;
}

export class SessionStudentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  studentCode!: string;

  @ApiProperty({ nullable: true })
  nationalId!: string | null;
}

export class SessionDetailResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  testTypeId!: string;

  @ApiProperty({ description: 'Hebrew test name, e.g. "ריצת 2000 מטר"' })
  testNameHe!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Hebrew unit label, e.g. "שניות"' })
  testUnit!: string | null;

  @ApiProperty({ enum: FitnessInputType, description: 'TIME | REPS | PASS_FAIL | GENERAL' })
  testInputType!: FitnessInputType;

  @ApiProperty()
  conductedAt!: Date;

  @ApiProperty()
  isStopwatch!: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Server-side stopwatch start timestamp' })
  startedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'Set when the session is explicitly closed' })
  completedAt!: Date | null;

  @ApiProperty({ type: [SessionStudentDto], description: 'All enrolled students, ordered alphabetically' })
  students!: SessionStudentDto[];

  @ApiProperty({ type: [LiveStudentResultDto], description: 'Results submitted so far in this session' })
  results!: LiveStudentResultDto[];
}
