import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Min } from 'class-validator';

export class SubmitResultDto {
  @ApiProperty({ description: 'ID of the student whose result is being submitted' })
  @IsString()
  studentId!: string;

  @ApiProperty({
    description: 'Raw measurement value — seconds for TIME, reps for REPS, 1/0 for PASS_FAIL, decimal for GENERAL',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rawValue!: number;
}
