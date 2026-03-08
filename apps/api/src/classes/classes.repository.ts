import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Semester } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ClassResponseDto } from './dto/class-response.dto';

export interface RawTestResult {
  studentId: string;
  calculatedGrade: number | null;
  gradeOverride: number | null;
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
  teacherId: string;
  joinCode: string;
  joinCodeExpiresAt: Date;
}

/** The Prisma select used for all class queries — keeps the shape consistent. */
const CLASS_SELECT = {
  id: true,
  name: true,
  academicYear: true,
  semester: true,
  joinCode: true,
  joinCodeExpiresAt: true,
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
    joinCode: raw.joinCode,
    joinCodeExpiresAt: raw.joinCodeExpiresAt,
    studentCount: raw._count.enrollments,
    createdAt: raw.createdAt,
  };
}

@Injectable()
export class ClassesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns all classes owned by a teacher, ordered by newest first. */
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
    const row = await this.prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: CLASS_SELECT,
    });
    if (row === null) {
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
    return toClassResponse(row);
  }

  /**
   * Loads all test results and attendance counts for a class in parallel.
   * Used to compute per-test summaries and attendance percentage for class details.
   */
  async findRawClassDetails(classId: string): Promise<RawClassDetails> {
    const [results, attendanceTotal, attendancePresent] = await Promise.all([
      this.prisma.testResult.findMany({
        where: { session: { classId } },
        select: {
          studentId: true,
          calculatedGrade: true,
          gradeOverride: true,
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
      this.prisma.attendanceRecord.count({ where: { classId } }),
      this.prisma.attendanceRecord.count({ where: { classId, status: 'PRESENT' } }),
    ]);
    return { results, attendanceTotal, attendancePresent };
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
          teacherId: input.teacherId,
          joinCode: input.joinCode,
          joinCodeExpiresAt: input.joinCodeExpiresAt,
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
