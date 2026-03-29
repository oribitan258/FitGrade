import { IsEnum, IsInt, IsOptional, IsString, Max, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Semester } from '@prisma/client';

export class UpsertScheduleEntryDto {
  @ApiProperty({ description: 'Day of week: 0=Sunday … 4=Thursday', minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  declare dayOfWeek: number;

  @ApiProperty({ description: '0-based period index', minimum: 0, maximum: 15 })
  @IsInt()
  @Min(0)
  @Max(15)
  @Type(() => Number)
  declare period: number;

  @ApiProperty({ description: 'Period start time in HH:MM format', example: '08:15' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:MM format' })
  declare startTime: string;

  @ApiProperty({ description: 'Class ID to assign to this slot' })
  @IsString()
  declare classId: string;

  @ApiPropertyOptional({ enum: Semester, default: Semester.A, description: 'Semester this timetable entry belongs to. Defaults to A.' })
  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;
}
