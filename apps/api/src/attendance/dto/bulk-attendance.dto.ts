import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Semester } from '@prisma/client';
import { AttendanceEntryDto } from './attendance-entry.dto';

export class BulkAttendanceDto {
  @ApiProperty({
    description: 'Attendance date in YYYY-MM-DD format',
    example: '2024-09-15',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    enum: Semester,
    default: Semester.A,
    description: 'Semester this attendance belongs to. Defaults to A if omitted.',
  })
  @IsOptional()
  @IsEnum(Semester)
  semester?: Semester;

  @ApiProperty({
    type: [AttendanceEntryDto],
    description: 'One entry per student — existing records are updated, new ones are created',
  })
  /** כיתה ישראלית מונה לכל היותר 200 תלמידים — ערך זה חוסם בקשות DoS */
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records!: AttendanceEntryDto[];
}
