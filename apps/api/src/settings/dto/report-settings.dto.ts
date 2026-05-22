import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Response shape for GET /settings/report-settings. */
export class ReportSettingsResponseDto {
  @ApiProperty({ example: 60, description: 'Minimum passing grade (0–100)' })
  passingGrade!: number;

  @ApiPropertyOptional({ example: 'אורי ביטן' })
  teacherName!: string | null;

  @ApiPropertyOptional({ example: 'בית הספר הריאלי' })
  schoolName!: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  schoolLogoUrl!: string | null;

  @ApiPropertyOptional({ example: 'data:image/png;base64,...' })
  teacherSignature!: string | null;
}

/** Request body for PATCH /settings/report-settings. */
export class UpdateReportSettingsDto {
  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passingGrade?: number;

  @ApiPropertyOptional({ example: 'אורי ביטן' })
  @IsOptional()
  @IsString()
  teacherName?: string | null;

  @ApiPropertyOptional({ example: 'בית הספר הריאלי' })
  @IsOptional()
  @IsString()
  schoolName?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/.+|data:image\/.+;base64,.+)$/, {
    message: 'schoolLogoUrl must be a valid https URL or a data:image base64 URI',
  })
  schoolLogoUrl?: string | null;

  @ApiPropertyOptional({ example: 'data:image/png;base64,...' })
  @IsOptional()
  @IsString()
  @MaxLength(524_288) // 512 KB encoded ≈ ~384 KB PNG — rejects runaway base64 blobs
  teacherSignature?: string | null;
}
