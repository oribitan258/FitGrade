import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StudentLoginDto {
  /** תעודת זהות — 1–9 ספרות (יורחב ל-9 עם אפסים מובילים לפני אימות Luhn) */
  @ApiProperty({ example: '123456789', description: 'תעודת זהות ישראלית — עד 9 ספרות' })
  @IsString()
  @Matches(/^\d{1,9}$/, { message: 'תעודת זהות לא תקינה' })
  nationalId!: string;

  @ApiPropertyOptional({ description: 'סיסמת כניסה' })
  @IsOptional()
  @IsString()
  password?: string;
}
