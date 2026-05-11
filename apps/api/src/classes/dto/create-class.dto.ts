import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassGenderType } from '@prisma/client';

export class CreateClassDto {
  @ApiProperty({ example: "כיתה י' 1" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  /**
   * Academic year in "YYYY-YYYY" format, e.g. "2024-2025".
   * Validated by regex to prevent freeform strings like "this year".
   */
  @ApiProperty({ example: '2024-2025' })
  @IsString()
  @Matches(/^\d{4}-\d{4}$/, {
    message: 'academicYear must be in the format "YYYY-YYYY" (e.g. "2024-2025")',
  })
  academicYear!: string;

  /** Gender composition of the class — defaults to MIXED when omitted. */
  @ApiPropertyOptional({ enum: ClassGenderType, enumName: 'ClassGenderType', default: ClassGenderType.MIXED })
  @IsOptional()
  @IsEnum(ClassGenderType)
  genderType?: ClassGenderType;

  /**
   * School grade level 1–12. Display metadata for the test picker recommended badges.
   * Optional — omit for legacy classes or when grade level is unknown.
   */
  @ApiPropertyOptional({ example: 10, description: 'School grade level 1–12. Display metadata only.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel?: number;
}
