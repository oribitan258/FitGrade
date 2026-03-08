import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ description: 'ID of the FitnessTestType to use for this session' })
  @IsString()
  testTypeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Set to true when using stopwatch mode (timer started server-side)',
  })
  @IsOptional()
  @IsBoolean()
  isStopwatch?: boolean;

  @ApiPropertyOptional({
    description: 'ISO 8601 date for past-dated sessions (e.g. "2025-11-14"); defaults to now',
  })
  @IsOptional()
  @IsDateString()
  conductedAt?: string;
}
