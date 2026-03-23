import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CopilotPageContextDto {
  @ApiProperty({ example: '/classes/abc123' })
  @IsString()
  @IsNotEmpty()
  currentRoute!: string;

  @ApiPropertyOptional({ example: 'abc123', nullable: true })
  @IsOptional()
  @IsString()
  classId!: string | null;

  @ApiPropertyOptional({ example: 'xyz456', nullable: true })
  @IsOptional()
  @IsString()
  studentId!: string | null;

  @ApiPropertyOptional({ example: '2025-03-16', nullable: true })
  @IsOptional()
  @IsString()
  selectedDate!: string | null;
}

export class CopilotChatDto {
  @ApiProperty({ description: 'The teacher\'s Hebrew message to the Copilot' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({
    description: 'UUID identifying the current conversation session. Resets when the panel is closed.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  conversationId!: string;

  @ApiProperty({ type: CopilotPageContextDto })
  @IsObject()
  @ValidateNested()
  @Type(() => CopilotPageContextDto)
  context!: CopilotPageContextDto;
}
