import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FitnessInputType } from '@prisma/client';

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

  @ApiProperty()
  createdAt!: Date;
}
