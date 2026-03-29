import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Semester } from '@prisma/client';

/**
 * Optional semester filter shared by all teacher-scoped list endpoints.
 * When omitted, queries return data across ALL semesters (backward-compatible).
 */
export class SemesterQueryDto {
  @ApiPropertyOptional({
    enum: Semester,
    description: 'Filter results to a specific semester (A or B). Omit to include all semesters.',
  })
  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;
}
