import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../../common/prisma-enums';

export class CreateStudentDto {
  @ApiProperty({ example: 'ישראל' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'ישראלי' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  /**
   * ISO 8601 date string (e.g. "2009-03-15").
   * The service converts this to a Date for DB storage.
   */
  @ApiProperty({ example: '2009-03-15' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ enum: Gender, enumName: 'Gender', example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  /**
   * Teacher-assigned student code — unique within the class (enforced
   * at the service layer, not by a DB constraint).
   */
  @ApiProperty({ example: '301', minLength: 2, maxLength: 10 })
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  studentCode!: string;

  /** Initial password chosen by or assigned to the student. Minimum 8 characters. */
  @ApiProperty({ example: 'securePass1', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
