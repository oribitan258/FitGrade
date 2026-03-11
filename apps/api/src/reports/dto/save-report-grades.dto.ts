import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** One student's grade + comment override. */
export class GradeOverrideDto {
  @ApiProperty({ description: 'Student ID' })
  @IsString()
  studentId!: string;

  @ApiPropertyOptional({ description: 'Teacher final grade 0–100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  teacherFinalGrade?: number;

  @ApiPropertyOptional({ description: 'Verbal Ministry comment or custom text' })
  @IsOptional()
  @IsString()
  verbalComment?: string;
}

/** Body for PATCH /reports/class/:classId */
export class SaveReportGradesDto {
  @ApiProperty({ type: [GradeOverrideDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradeOverrideDto)
  grades!: GradeOverrideDto[];
}
