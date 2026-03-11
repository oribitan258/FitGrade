import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class AttendanceEntryDto {
  @ApiProperty({ description: 'ID of the student' })
  @IsString()
  studentId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Required when status is EXCUSED. Reason for the exemption.' })
  @ValidateIf((o: AttendanceEntryDto) => o.status === AttendanceStatus.EXCUSED)
  @IsString()
  @MinLength(2)
  exemptionReason?: string;

  @ApiPropertyOptional({ description: 'Optional expiry date in YYYY-MM-DD format. null = no automatic expiry.' })
  @IsOptional()
  @IsDateString()
  exemptionExpiresAt?: string;
}
