import { ApiProperty } from '@nestjs/swagger';

/** Single attendance entry for the authenticated student's history. */
export class StudentAttendanceRecordDto {
  @ApiProperty()
  date!: string;

  @ApiProperty({ enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] })
  status!: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

/** Attendance summary + full record list returned by GET /students/me/attendance. */
export class StudentAttendanceSummaryDto {
  @ApiProperty()
  present!: number;

  @ApiProperty()
  absent!: number;

  @ApiProperty()
  late!: number;

  @ApiProperty()
  excused!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [StudentAttendanceRecordDto] })
  records!: StudentAttendanceRecordDto[];
}

/** Single test result returned by GET /students/me/results. */
export class StudentResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'ISO date string of the test session' })
  sessionDate!: string;

  @ApiProperty({ description: 'Hebrew name of the fitness test type' })
  testNameHe!: string;

  @ApiProperty({ description: 'Raw performance value (e.g. seconds, reps)' })
  rawValue!: number;

  /**
   * Effective grade (0–100): gradeOverride when set by teacher, otherwise calculatedGrade.
   * Never render this directly — always pass through getHebrewGradeLabel() on the client.
   */
  @ApiProperty()
  effectiveGrade!: number;
}
