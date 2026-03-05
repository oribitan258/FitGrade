import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttendanceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  classId!: string;

  @ApiProperty()
  studentId!: string;

  @ApiProperty({ description: 'Attendance date as ISO string' })
  date!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
