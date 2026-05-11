import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassGenderType } from '@prisma/client';

export class ClassResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: "כיתה י' 1" })
  name!: string;

  @ApiProperty({ example: '2024-2025' })
  academicYear!: string;

  @ApiProperty({ enum: ClassGenderType, description: 'Gender composition: BOYS | GIRLS | MIXED' })
  genderType!: ClassGenderType;

  @ApiProperty({ example: 'AB3X7Q' })
  joinCode!: string;

  @ApiProperty({ nullable: true, type: Date })
  joinCodeExpiresAt!: Date | null;

  /** Total number of students currently enrolled in this class. */
  @ApiProperty({ example: 28 })
  studentCount!: number;

  @ApiProperty()
  createdAt!: Date;

  /**
   * School grade level 1–12. Display metadata used by the test picker to render
   * recommended badges. null for legacy classes created before this field existed.
   */
  @ApiPropertyOptional({ nullable: true, example: 10 })
  gradeLevel!: number | null;

  /**
   * Per-class fitness-test weight override (0–100).
   * null = use the teacher's global defaultFitnessWeight.
   */
  @ApiPropertyOptional({ nullable: true, example: 55 })
  testWeight!: number | null;

  /**
   * Per-class Talmida'ut weight override (0–100).
   * null = use the teacher's global defaultConductWeight.
   */
  @ApiPropertyOptional({ nullable: true, example: 45 })
  talmidautWeight!: number | null;
}
