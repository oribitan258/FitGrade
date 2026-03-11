import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ description: 'ISO 8601 date string' })
  eventDate!: string;

  @ApiPropertyOptional()
  location!: string | null;

  @ApiProperty()
  teacherId!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
