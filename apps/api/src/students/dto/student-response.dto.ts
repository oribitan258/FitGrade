import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

/**
 * Shape returned for every student response.
 * passwordHash is intentionally omitted — never selected in repository queries.
 */
export class StudentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'ישראל' })
  firstName!: string;

  @ApiProperty({ example: 'ישראלי' })
  lastName!: string;

  @ApiProperty({ example: '301' })
  studentCode!: string;

  @ApiProperty({ example: '123456789', nullable: true })
  nationalId!: string | null;

  @ApiProperty({ enum: Gender })
  gender!: Gender;

  @ApiProperty({ nullable: true })
  dateOfBirth!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
