import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { WeightsSumTo100 } from '../../common/validators/weights-sum.validator';

/**
 * Request body for PATCH /classes/:id/grading-policy.
 * Pass null for both fields to reset to the teacher's global defaults.
 * When non-null values are provided, they must sum to 100.
 */
export class UpdateClassWeightsDto {
  @ApiPropertyOptional({
    nullable: true,
    example: 70,
    description: 'Fitness test weight override (0–100). null = use global default.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @WeightsSumTo100('talmidautWeight')
  testWeight!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 30,
    description: 'Talmida\'ut weight override (0–100). null = use global default.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  talmidautWeight!: number | null;
}
