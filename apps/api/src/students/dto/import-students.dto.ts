import { ApiProperty } from '@nestjs/swagger';

/** A single row-level error from the Excel/CSV import parser. */
export class ImportRowErrorDto {
  @ApiProperty({ example: 3 })
  row!: number;

  @ApiProperty({ example: '123456789', required: false })
  nationalId?: string;

  @ApiProperty({ example: 'מספר זהות לא תקין' })
  reason!: string;
}

/** Summary returned after a bulk student import. */
export class ImportResultDto {
  @ApiProperty({ example: 28, description: 'תלמידים חדשים שנוספו ונרשמו' })
  added!: number;

  @ApiProperty({ example: 2, description: 'תלמידים שכבר רשומים בכיתה זו (דולגו)' })
  existing!: number;

  @ApiProperty({ example: 1, description: 'תלמידים שהיו בכיתה אחרת והצטרפו לכיתה זו' })
  reEnrolled!: number;

  @ApiProperty({ type: [ImportRowErrorDto], description: 'שורות שנכשלו' })
  errors!: ImportRowErrorDto[];
}

/** Internal parsed row from the uploaded file — validated before DB writes. */
export interface ParsedStudentRow {
  /** Padded 9-digit national ID, Luhn-validated */
  nationalId: string;
  firstName: string;
  lastName: string;
  /** null if the gender column was missing or blank in this row */
  gender: 'MALE' | 'FEMALE' | null;
  /** 1-based index in the original file for error reporting */
  rowIndex: number;
}
