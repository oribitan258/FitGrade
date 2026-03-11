import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class GetAttendanceQueryDto {
  @ApiProperty({ description: 'Date to fetch attendance for, in YYYY-MM-DD format', example: '2024-09-15' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: 'When true, returns only active EXCUSED records (exemptionExpiresAt is null or >= today)' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  activeOnly?: boolean;
}
