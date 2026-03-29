import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinalGradeDto } from './student-profile-response.dto';

/**
 * One test-type entry in the formal student report.
 * Represents the student's most recent result for that test type in the
 * requested semester, plus the class-wide average for context.
 */
export class ReportTestResultDto {
  @ApiProperty()
  testTypeId!: string;

  @ApiProperty({ description: 'שם המבחן בעברית, e.g. "ריצת 2000 מטר"' })
  nameHe!: string;

  @ApiPropertyOptional({ nullable: true, description: 'יחידת מידה, e.g. "שניות"' })
  unit!: string | null;

  @ApiProperty({ description: 'TIME | REPS | PASS_FAIL | GENERAL' })
  inputType!: string;

  @ApiProperty({ description: 'ISO 8601 date of the most recent session for this test' })
  conductedAt!: string;

  @ApiProperty({ description: 'ציון אפקטיבי — gradeOverride ?? calculatedGrade (0–100)' })
  grade!: number;

  @ApiPropertyOptional({ nullable: true, description: 'ערך גולמי מהסשן האחרון (שניות / חזרות וכו׳)' })
  rawValue!: number | null;

  @ApiProperty({ description: 'ממוצע ציוני כלל תלמידי הכיתה עבור מבחן זה באותו סמסטר (0–100)' })
  classAvg!: number;

  @ApiProperty({ description: 'מספר פעמים שהתלמיד ביצע מבחן זה' })
  sessionCount!: number;
}

/**
 * Aggregated attendance metrics for the report.
 */
export class ReportAttendanceDto {
  @ApiProperty({ description: 'סה"כ רשומות נוכחות בכיתה' })
  total!: number;

  @ApiProperty({ description: 'נוכח' })
  present!: number;

  @ApiProperty({ description: 'נעדר' })
  absent!: number;

  @ApiProperty({ description: 'פטור / פציעה' })
  excused!: number;

  @ApiProperty({ description: 'אחוז נוכחות (0–100)' })
  pct!: number;
}

/**
 * Full formal student report — covers one student in one class,
 * optionally scoped to a single semester.
 *
 * Returned by GET /classes/:classId/students/:studentId/report
 */
export class StudentReportResponseDto {
  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ description: 'MALE | FEMALE' })
  gender!: string;

  @ApiProperty()
  dateOfBirth!: Date;

  @ApiProperty()
  studentCode!: string;

  @ApiProperty({ description: 'שם הכיתה' })
  className!: string;

  @ApiPropertyOptional({ nullable: true, description: 'שכבת לימוד (1–12), null = ישן' })
  gradeLevel!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'הסמסטר המבוקש (A | B). null = כל הסמסטרים',
  })
  semester!: string | null;

  @ApiProperty({ description: 'ISO 8601 timestamp — מועד הפקת הדוח' })
  generatedAt!: string;

  @ApiProperty({ type: [ReportTestResultDto], description: 'תוצאות מבחנים — מבחן אחד לשורה, מהמשובח לחלש' })
  testResults!: ReportTestResultDto[];

  @ApiProperty({ type: ReportAttendanceDto })
  attendance!: ReportAttendanceDto;

  @ApiProperty({ type: FinalGradeDto, description: 'ציון סופי מומלץ' })
  finalGrade!: FinalGradeDto;
}
