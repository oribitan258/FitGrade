import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class GetAttendanceQueryDto {
  @ApiProperty({ description: 'Date to fetch attendance for, in YYYY-MM-DD format', example: '2024-09-15' })
  @IsDateString()
  date!: string;
}
