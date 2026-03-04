import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, ValidateNested } from 'class-validator';
import { AttendanceEntryDto } from './attendance-entry.dto';

export class BulkAttendanceDto {
  @ApiProperty({
    description: 'Attendance date in YYYY-MM-DD format',
    example: '2024-09-15',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    type: [AttendanceEntryDto],
    description: 'One entry per student — existing records are updated, new ones are created',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records!: AttendanceEntryDto[];
}
