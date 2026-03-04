import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StudentLoginDto {
  /** The class join code — used to identify which class the student belongs to. */
  @ApiProperty({ example: 'AB3X7Q' })
  @IsString()
  @IsNotEmpty()
  classCode!: string;

  /** The student's assigned code within the class. */
  @ApiProperty({ example: '301' })
  @IsString()
  @IsNotEmpty()
  studentCode!: string;

  @ApiProperty({ example: 'myPassword123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
