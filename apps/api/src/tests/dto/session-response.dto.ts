import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  testTypeId!: string;

  @ApiProperty()
  conductedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  isStopwatch!: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Server-side stopwatch start time' })
  startedAt!: Date | null;
}
