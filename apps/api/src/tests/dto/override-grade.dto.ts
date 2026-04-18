import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class OverrideGradeDto {
  @ApiProperty({ description: 'Override grade set by teacher (0–100)', minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  gradeOverride!: number;

  @ApiProperty({ description: 'Mandatory reason for the grade override' })
  @IsString()
  @MinLength(3)
  overrideReason!: string;
}
