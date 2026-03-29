import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Semester } from '@prisma/client';

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  testTypeId!: string;

  @ApiProperty({ enum: Semester })
  semester!: Semester;

  @ApiProperty()
  conductedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  isStopwatch!: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Server-side stopwatch start time' })
  startedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, description: 'Timestamp when the session was explicitly closed' })
  completedAt!: Date | null;
}
