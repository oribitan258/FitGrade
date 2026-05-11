import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

/**
 * Body for PATCH /auth/onboarding/preferences.
 *
 * Both arrays are required (use [] to clear). Service validates that every
 * test type ID exists in FitnessTestType before persisting.
 *
 * ArrayMaxSize(50) caps DoS surface — the catalog is ~10–15 types, 50 leaves
 * generous headroom but rejects pathological payloads.
 */
export class OnboardingPreferencesDto {
  @ApiProperty({
    description: 'Test type IDs preferred for MALE/BOYS classes',
    type: [String],
    example: [],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  defaultMaleTestIds!: string[];

  @ApiProperty({
    description: 'Test type IDs preferred for FEMALE/GIRLS classes',
    type: [String],
    example: [],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  defaultFemaleTestIds!: string[];
}
