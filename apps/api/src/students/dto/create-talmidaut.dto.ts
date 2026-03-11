import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTalmidautDto {
  @ApiProperty({ description: 'ציון השתתפות (0–100)', minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  participation!: number;

  @ApiProperty({ description: 'ציון לבוש (0–100)', minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  uniform!: number;

  @ApiProperty({ description: 'ציון התנהגות (0–100)', minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  behavior!: number;

  @ApiPropertyOptional({ description: 'הערות אופציונליות' })
  @IsOptional()
  @IsString()
  notes?: string;
}
