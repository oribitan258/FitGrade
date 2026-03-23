import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class OverrideGradeDto {
  @ApiProperty({ description: 'Override grade set by teacher (0–100)', minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  gradeOverride!: number;

  @ApiPropertyOptional({ description: 'Reason for the grade override' })
  @IsOptional()
  @IsString()
  overrideReason?: string;
}
