import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/** Response shape for GET /settings/grading-policy. */
export class GradingPolicyResponseDto {
  @ApiProperty({ example: 55, description: 'Fitness test weight (0–100)' })
  fitnessWeight!: number;

  @ApiProperty({ example: 45, description: 'Talmida\'ut conduct weight (0–100)' })
  conductWeight!: number;
}

/** Request body for PATCH /settings/grading-policy. */
export class UpdateGradingPolicyDto {
  @ApiProperty({ example: 60, description: 'Fitness weight (0–100). Must sum to 100 with conductWeight.' })
  @IsInt()
  @Min(0)
  @Max(100)
  fitnessWeight!: number;

  @ApiProperty({ example: 40 })
  @IsInt()
  @Min(0)
  @Max(100)
  conductWeight!: number;
}
