import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FitnessInputType, TestCategory } from '@prisma/client';

export class TestTypeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Hebrew name of the test, e.g. "ריצה 1 ק\"מ"' })
  nameHe!: string;

  @ApiPropertyOptional({ nullable: true })
  descriptionHe!: string | null;

  @ApiProperty({ enum: FitnessInputType })
  inputType!: FitnessInputType;

  @ApiPropertyOptional({ nullable: true, description: 'Unit label in Hebrew, e.g. "שניות"' })
  unit!: string | null;

  @ApiProperty()
  isGlobal!: boolean;

  @ApiProperty({
    description:
      'True for distance/reps tests (higher value = better); ' +
      'false for time tests (lower value = better).',
  })
  higherIsBetter!: boolean;

  @ApiProperty({ enum: TestCategory, description: 'Logical category for UI grouping.' })
  category!: TestCategory;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Recommended minimum school grade (1–12). Display metadata only.',
  })
  minGrade!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Recommended maximum school grade (1–12). Display metadata only.',
  })
  maxGrade!: number | null;

  @ApiProperty()
  createdAt!: Date;
}
