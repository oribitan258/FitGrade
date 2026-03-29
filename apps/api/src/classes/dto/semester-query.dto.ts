import { IsEnum, IsOptional } from 'class-validator';
import { Semester } from '@prisma/client';

/**
 * Optional semester filter for query endpoints.
 * When omitted, the endpoint returns data for all semesters.
 * Used by: GET /classes/:id/details, GET /classes/:classId/students/:studentId/profile
 */
export class SemesterQueryDto {
  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;
}
