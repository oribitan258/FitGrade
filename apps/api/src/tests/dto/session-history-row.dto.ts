import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Semester } from '@prisma/client';

export class SessionHistoryRowDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  testTypeId!: string;

  @ApiProperty({ description: 'Hebrew name of the test type' })
  testNameHe!: string;

  @ApiProperty()
  conductedAt!: Date;

  @ApiProperty({ enum: Semester })
  semester!: Semester;

  @ApiProperty()
  isStopwatch!: boolean;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ description: 'Number of results recorded in this session' })
  resultCount!: number;
}
