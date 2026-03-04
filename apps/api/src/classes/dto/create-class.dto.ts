import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Semester } from '@prisma/client';

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

  @ApiProperty({ enum: Semester, enumName: 'Semester', example: Semester.A })
  @IsEnum(Semester)
  semester!: Semester;
}
