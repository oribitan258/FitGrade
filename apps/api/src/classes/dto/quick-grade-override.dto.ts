import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class QuickGradeOverrideDto {
  @ApiProperty({ description: 'The test type to set the override for' })
  @IsString()
  testTypeId!: string;

  /**
   * Guard against `enableImplicitConversion: true` coercing null → 0.
   * The Transform runs during class-transformer phase (before class-validator),
   * so null is preserved and @IsOptional() can correctly skip the int validators.
   */
  @ApiPropertyOptional({ description: 'Grade override value (0–100), or null to clear the override', nullable: true })
  @Transform(({ value }: { value: unknown }) =>
    value === null || value === undefined ? null : Number(value),
  )
  @IsOptional()
  @ValidateIf((o: QuickGradeOverrideDto) => o.gradeOverride !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  gradeOverride!: number | null;
}

export class QuickGradeResponseDto {
  @ApiProperty({ description: 'Resolved effective grade after applying the override' })
  effectiveGrade!: number;
}
