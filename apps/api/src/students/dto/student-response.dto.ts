import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty()
  gender!: string;

  @ApiProperty()
  dateOfBirth!: Date;

  @ApiProperty()
  createdAt!: Date;
}
