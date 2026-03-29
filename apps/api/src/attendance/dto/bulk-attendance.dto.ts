import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, ValidateNested } from 'class-validator';
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records!: AttendanceEntryDto[];
}
