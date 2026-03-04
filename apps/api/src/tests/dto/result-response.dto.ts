import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResultResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  studentId!: string;

  @ApiProperty({ description: 'Raw measurement submitted by the teacher' })
  rawValue!: number;

  @ApiProperty({ description: 'Grade (0–100) automatically calculated by GradingService' })
  calculatedGrade!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Manual override grade set by teacher (0–100)' })
  gradeOverride!: number | null;

  @ApiProperty()
  recordedAt!: Date;
}
