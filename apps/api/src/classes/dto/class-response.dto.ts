import { ApiProperty } from '@nestjs/swagger';
import { Semester } from '@prisma/client';

export class ClassResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: "כיתה י' 1" })
  name!: string;

  @ApiProperty({ example: '2024-2025' })
  academicYear!: string;

  @ApiProperty({ enum: Semester })
  semester!: Semester;

  @ApiProperty({ example: 'AB3X7Q' })
  joinCode!: string;

  @ApiProperty({ nullable: true, type: Date })
  joinCodeExpiresAt!: Date | null;

  /** Total number of students currently enrolled in this class. */
  @ApiProperty({ example: 28 })
  studentCount!: number;

  @ApiProperty()
  createdAt!: Date;
}
