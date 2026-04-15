import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ClassGenderType, Semester } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ClassResponseDto } from './dto/class-response.dto';

export interface RawTestResult {
  studentId: string;
  calculatedGrade: number | null;
  gradeOverride: number | null;
  rawValue: Prisma.Decimal | null;
  session: {
    testTypeId: string;
    conductedAt: Date;
    testType: { nameHe: string; unit: string | null };
  };
}

export interface RawClassDetails {
  results: RawTestResult[];
  attendanceTotal: number;
  attendancePresent: number;
}

/** Input shape for creating a new class (all server-side fields included). */
export interface CreateClassInput {
  name: string;
  academicYear: string;
  semester: Semester;
  genderType: ClassGenderType;
  teacherId: string;
  joinCode: string;
  joinCodeExpiresAt: Date;
  gradeLevel?: number;
}

/** The Prisma select used for all class queries — keeps the shape consistent. */
const CLASS_SELECT = {
  id: true,
  name: true,
  academicYear: true,
  semester: true,
  genderType: true,
  joinCode: true,
  joinCodeExpiresAt: true,
  gradeLevel: true,
  testWeight: true,
  talmidautWeight: true,
  createdAt: true,
  _count: { select: { enrollments: true } },
} as const;

/** Maps the raw Prisma result (with _count) to the flat ClassResponseDto shape. */
function toClassResponse(
  raw: Prisma.ClassGetPayload<{ select: typeof CLASS_SELECT }>,
): ClassResponseDto {
  return {
    id: raw.id,
    name: raw.name,
    academicYear: raw.academicYear,
    semester: raw.semester,
    genderType: raw.genderType,
    joinCode: raw.joinCode,
    joinCodeExpiresAt: raw.joinCodeExpiresAt,
    gradeLevel: raw.gradeLevel,
    testWeight: raw.testWeight,
    talmidautWeight: raw.talmidautWeight,
    studentCount: raw._count.enrollments,
    createdAt: raw.createdAt,
  };
}

@Injectable()
export class ClassesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all classes owned by a teacher, ordered by newest first.
   * Classes are year-round entities — no semester filtering applied here.
   * Semester filtering is applied at the TestSession level in dashboard queries.
   */
  async findAllByTeacher(teacherId: string): Promise<ClassResponseDto[]> {
    const rows = await this.prisma.class.findMany({
      where: { teacherId },
      select: CLASS_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toClassResponse);
  }

  /**
   * Returns a single class owned by `teacherId`.
   * Throws NotFoundException if the class doesn't exist or belongs to another teacher.
   */
  async findOneByIdAndTeacher(
    classId: string,
    teacherId: string,
  ): Promise<ClassResponseDto> {
    const row = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { ...CLASS_SELECT, teacherId: true },
    });
    if (row === null) {
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
    if (row.teacherId !== teacherId) {
      throw new ForbiddenException();
    }
    const { teacherId: _tid, ...rest } = row;
    return toClassResponse(rest);
  }

  /**
   * Loads all test results and attendance counts for a class in parallel.
   * Direct query on testResult filtered by session.classId (and optionally semester).
   * Mirrors the dashboard pattern. When semester is omitted, returns all semesters.
   * Attendance counts are not semester-filtered (they have no semester dimension).
   */
  async findRawClassDetails(classId: string, semester?: Semester): Promise<RawClassDetails> {
    const semesterFilter = semester !== undefined ? { semester } : {};

    const [results, attendanceTotal, attendancePresent] = await Promise.all([
      this.prisma.testResult.findMany({
        where: { session: { classId, ...semesterFilter } },
        select: {
          studentId: true,
          calculatedGrade: true,
          gradeOverride: true,
          rawValue: true,
          session: {
            select: {
              testTypeId: true,
              conductedAt: true,
              testType: { select: { nameHe: true, unit: true } },
            },
          },
        },
        orderBy: { session: { conductedAt: 'asc' } },
      }),
      // Count only PRESENT + ABSENT — EXCUSED lessons do not count against the student
      this.prisma.attendanceRecord.count({ where: { classId, status: { not: 'EXCUSED' }, ...(semester !== undefined ? { semester } : {}) } }),
      this.prisma.attendanceRecord.count({ where: { classId, status: 'PRESENT', ...(semester !== undefined ? { semester } : {}) } }),
    ]);

    return { results, attendanceTotal, attendancePresent };
  }

  /**
   * Updates per-class weight overrides. Pass null to clear an override (falls back to global defaults).
   * Throws NotFoundException if the class doesn't belong to the teacher.
   */
  async updateWeights(
    classId: string,
    teacherId: string,
    testWeight: number | null,
    talmidautWeight: number | null,
  ): Promise<ClassResponseDto> {
    const existing = await this.prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: { id: true },
    });
    if (existing === null) {
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
    const row = await this.prisma.class.update({
      where: { id: classId },
      data: { testWeight, talmidautWeight },
      select: CLASS_SELECT,
    });
    return toClassResponse(row);
  }

  /**
   * Overrides the effective grade for the most recent TestResult for a given
   * (studentId, testTypeId) pair in the class.
   * Throws NotFoundException if no result exists (student never took this test).
   */
  async quickGradeOverride(
    classId: string,
    studentId: string,
    testTypeId: string,
    gradeOverride: number | null,
  ): Promise<{ effectiveGrade: number }> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.testResult.findFirst({
        where: { studentId, session: { classId, testTypeId } },
        orderBy: { session: { conductedAt: 'desc' } },
        select: { id: true, calculatedGrade: true },
      });
      if (result === null) {
        throw new NotFoundException(`לא נמצאה תוצאת מבחן לתלמיד זה בכיתה זו`);
      }
      const updated = await tx.testResult.update({
        where: { id: result.id },
        data: { gradeOverride },
        select: { gradeOverride: true, calculatedGrade: true },
      });
      return {
        effectiveGrade: updated.gradeOverride ?? updated.calculatedGrade ?? 0,
      };
    });
  }

  /**
   * Creates a new class.
   * Throws ConflictException if the generated join code collides (P2002).
   * The service retries with a fresh code on conflict.
   */
  async create(input: CreateClassInput): Promise<ClassResponseDto> {
    try {
      const row = await this.prisma.class.create({
        data: {
          name: input.name,
          academicYear: input.academicYear,
          semester: input.semester,
          genderType: input.genderType,
          teacherId: input.teacherId,
          joinCode: input.joinCode,
          joinCodeExpiresAt: input.joinCodeExpiresAt,
          ...(input.gradeLevel !== undefined ? { gradeLevel: input.gradeLevel } : {}),
        },
        select: CLASS_SELECT,
      });
      return toClassResponse(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'שגיאה ביצירת קוד הצטרפות — נסה שוב',
        );
      }
      throw e;
    }
  }
}
