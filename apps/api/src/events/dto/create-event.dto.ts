import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ example: 'יום ספורט בית-ספרי' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'ISO 8601 date string', example: '2026-03-22T10:00:00.000Z' })
  @IsDateString()
  eventDate!: string;

  @ApiPropertyOptional({ example: 'מגרש הספורט' })
  @IsString()
  @IsOptional()
  location?: string;
}
