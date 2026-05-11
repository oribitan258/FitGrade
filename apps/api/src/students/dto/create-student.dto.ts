import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

export class CreateStudentDto {
  @ApiProperty({ example: 'ישראל' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'ישראלי' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ enum: Gender, enumName: 'Gender', example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: '123456789', description: 'תעודת זהות — 1 עד 9 ספרות' })
  @IsString()
  @Matches(/^\d{1,9}$/, { message: 'תעודת זהות חייבת להכיל ספרות בלבד (עד 9)' })
  nationalId!: string;
}
