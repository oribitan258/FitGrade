import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class EditResultRawValueDto {
  @ApiProperty({ description: 'New raw measurement value (must be ≥ 0)' })
  @IsNumber()
  @Min(0)
  rawValue!: number;
}
