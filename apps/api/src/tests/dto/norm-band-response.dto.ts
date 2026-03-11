import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NormBandDto {
  @ApiProperty({ description: 'Gender: MALE | FEMALE | OTHER' })
  gender!: string;

  @ApiProperty({ description: 'Minimum student age (inclusive)' })
  minAge!: number;

  @ApiProperty({ description: 'Maximum student age (inclusive)' })
  maxAge!: number;

  @ApiProperty({ description: 'Grade awarded (2–100)' })
  score!: number;

  @ApiProperty({ description: 'Lower bound of the raw-value band (inclusive)' })
  minValue!: number;

  @ApiProperty({ description: 'Upper bound of the raw-value band (exclusive)' })
  maxValue!: number;
}

export class TestTypeNormsResponseDto {
  @ApiProperty()
  testTypeId!: string;

  @ApiProperty({ description: 'Hebrew test name' })
  nameHe!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Hebrew unit label' })
  unit!: string | null;

  @ApiProperty({ description: 'TIME | REPS | PASS_FAIL | GENERAL' })
  inputType!: string;

  @ApiProperty({
    description:
      'True for distance/reps tests where higher raw value = better score; ' +
      'false for time tests where lower raw value = better score.',
  })
  higherIsBetter!: boolean;

  @ApiProperty({
    type: [NormBandDto],
    description:
      'All NormTable bands for this test type, ordered by minAge → gender → score desc. ' +
      'Filter client-side by gender + (minAge, maxAge) for a single view.',
  })
  bands!: NormBandDto[];
}
