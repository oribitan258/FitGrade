import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';

export class AttendanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  studentId!: string;

  @ApiProperty({ description: 'Attendance date as ISO string' })
  date!: string;

  @ApiProperty({ enum: AttendanceStatus })
  status!: AttendanceStatus;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Reason for exemption (when status = EXCUSED)' })
  exemptionReason!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Exemption expiry as ISO string; null = no expiry' })
  exemptionExpiresAt!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
