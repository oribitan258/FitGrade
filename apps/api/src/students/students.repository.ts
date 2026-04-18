import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, Gender, Prisma, Semester } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StudentResponseDto } from './dto/student-response.dto';

// ─── Report raw types ─────────────────────────────────────────────────────────

/** One test result row for the student being reported. */
export interface RawReportResult {
  rawValue: Prisma.Decimal | null;
  calculatedGrade: number | null;
  gradeOverride: number | null;
  session: {
    testTypeId: string;
    conductedAt: Date;
    testType: { nameHe: string; unit: string | null; inputType: string };
  };
}

/** Lightweight result row for computing class-wide benchmarks. */
export interface RawBenchmarkResult {
  calculatedGrade: number | null;
  gradeOverride: number | null;
  session: { testTypeId: string };
}

/** All raw data needed to build StudentReportResponseDto. */
export interface RawReportData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    gender: Gender;
    dateOfBirth: Date;
    studentCode: string;
  };
  cls: {
    name: string;
    gradeLevel: number | null;
    testWeight: number | null;
    talmidautWeight: number | null;
  };
  studentResults: RawReportResult[];
  /** Aggregated attendance counts keyed by AttendanceStatus. */
  attendanceCounts: Record<string, number>;
  /** All results for every student in the class — used for class-average benchmarks. */
  classResults: RawBenchmarkResult[];
  talmidautRecords: { participation: number; uniform: number; behavior: number }[];
}

/** Raw test result row used by findRawStudentProfile. */
export interface RawStudentResult {
  rawValue: Prisma.Decimal | null;
  calculatedGrade: number | null;
  gradeOverride: number | null;
  session: {
    testTypeId: string;
    conductedAt: Date;
    testType: { nameHe: string; unit: string | null; inputType: string };
  };
}

/** Raw attendance row used by findRawStudentProfile. */
export interface RawAttendanceRow {
  status: AttendanceStatus;
}

/** Raw talmidaut row used by findRawStudentProfile. */
export interface RawTalmidautRow {
  id: string;
  participation: number;
  uniform: number;
  behavior: number;
  notes: string | null;
  recordedAt: Date;
}

/** Class weight fields returned alongside profile data. null = inherit from teacher global defaults. */
export interface ClassWeights {
  testWeight: number | null;
  talmidautWeight: number | null;
}

/** All raw data needed to build StudentProfileResponseDto. */
export interface RawStudentProfile {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: Gender;
    studentCode: string;
  };
  results: RawStudentResult[];
  attendanceTotal: number;
  attendancePresent: number;
  recentAttendance: RawAttendanceRow[];
  talmidautRecords: RawTalmidautRow[];
  classWeights: ClassWeights;
}

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: Gender;
  studentCode: string;
  passwordHash: string; // pre-hashed by StudentsService
}

export interface CreateTalmidautInput {
  participation: number;
  uniform: number;
  behavior: number;
  notes?: string;
  /** Calendar date of the lesson. Defaults to today when omitted. */
  lessonDate?: Date;
}

export interface RawGradeComponents {
  cls: { testWeight: number | null; talmidautWeight: number | null };
  testResults: Array<{ calculatedGrade: number | null; gradeOverride: number | null; testTypeId: string }>;
  talmidautRecords: Array<{ participation: number; uniform: number; behavior: number }>;
}

export interface FinalGradeResult {
  fitnessAvg: number;
  talmidautAvg: number;
  recommendedGrade: number;
  testWeight: number;
  talmidautWeight: number;
}

/** Explicit select for all student queries — passwordHash is always excluded. */
const STUDENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  studentCode: true,
  gender: true,
  dateOfBirth: true,
  createdAt: true,
} as const;

@Injectable()
export class StudentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies the class exists and belongs to the given teacher.
   * Throws NotFoundException if ownership cannot be confirmed.
   */
  async verifyClassOwnership(
    classId: string,
    teacherId: string,
  ): Promise<void> {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
      select: { id: true, teacherId: true },
    });
    if (cls === null) {
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
    if (cls.teacherId !== teacherId) {
      throw new ForbiddenException();
    }
  }

  /**
   * Returns all active (non-deleted) students enrolled in a class, ordered alphabetically by last name.
   */
  async findByClassId(classId: string): Promise<StudentResponseDto[]> {
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId, student: { deletedAt: null } },
      select: { student: { select: STUDENT_SELECT } },
      orderBy: { student: { lastName: 'asc' } },
    });
    return enrollments.map((e) => e.student);
  }

  /**
   * Soft-deletes a student by setting deletedAt. Historical data (results, attendance) is preserved.
   * Throws NotFoundException if the student is not found in this class.
   */
  async softDeleteStudent(studentId: string, classId: string): Promise<void> {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: { studentId, classId, student: { deletedAt: null } },
      select: { id: true },
    });
    if (enrollment === null) {
      throw new NotFoundException(`תלמיד ${studentId} אינו רשום לכיתה זו`);
    }
    await this.prisma.student.update({
      where: { id: studentId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Verifies that a student is enrolled in the given class.
   * Throws NotFoundException if the enrollment doesn't exist.
   */
  async verifyStudentInClass(
    studentId: string,
    classId: string,
  ): Promise<void> {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: { studentId, classId },
      select: { id: true },
    });
    if (enrollment === null) {
      throw new NotFoundException(`תלמיד ${studentId} אינו רשום לכיתה זו`);
    }
  }

  /**
   * Loads all raw data needed to build a student profile in a single round-trip.
   * When `semester` is provided, test results are scoped to that semester only
   * (via the nested TestSession.semester field). Attendance and Talmidaut records
   * are not semester-filtered (they are date-stamped or class-scoped).
   * Throws NotFoundException if the student doesn't exist.
   */
  async findRawStudentProfile(
    studentId: string,
    classId: string,
    semester?: Semester,
  ): Promise<RawStudentProfile> {
    const [student, results, attendanceTotal, attendancePresent, recentAttendance, talmidautRecords, classData] =
      await Promise.all([
        this.prisma.student.findFirst({
          where: { id: studentId, deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            studentCode: true,
          },
        }),
        this.prisma.testResult.findMany({
          where: { studentId, session: { classId, ...(semester !== undefined ? { semester } : {}) } },
          select: {
            rawValue: true,
            calculatedGrade: true,
            gradeOverride: true,
            session: {
              select: {
                testTypeId: true,
                conductedAt: true,
                testType: { select: { nameHe: true, unit: true, inputType: true } },
              },
            },
          },
          orderBy: { session: { conductedAt: 'asc' } },
        }),
        // Count only PRESENT + ABSENT — EXCUSED lessons do not count against the student
        this.prisma.attendanceRecord.count({ where: { studentId, classId, status: { not: 'EXCUSED' } } }),
        this.prisma.attendanceRecord.count({
          where: { studentId, classId, status: 'PRESENT' },
        }),
        this.prisma.attendanceRecord.findMany({
          where: { studentId, classId },
          orderBy: { date: 'asc' },
          take: 6,
          select: { status: true },
        }),
        this.prisma.talmidautRecord.findMany({
          where: { studentId, classId },
          orderBy: { recordedAt: 'desc' },
          select: {
            id: true,
            participation: true,
            uniform: true,
            behavior: true,
            notes: true,
            recordedAt: true,
          },
        }),
        this.prisma.class.findFirstOrThrow({
          where: { id: classId, deletedAt: null },
          select: { testWeight: true, talmidautWeight: true },
        }),
      ]);

    if (student === null) {
      throw new NotFoundException(`תלמיד ${studentId} לא נמצא`);
    }

    return {
      student,
      results,
      attendanceTotal,
      attendancePresent,
      recentAttendance,
      talmidautRecords,
      classWeights: {
        testWeight: classData.testWeight,
        talmidautWeight: classData.talmidautWeight,
      },
    };
  }

  /**
   * Creates a TalmidautRecord and atomically upserts StudentFinalGrade.
   * Both writes are wrapped in a single $transaction for atomicity (BUG-021).
   * Throws ConflictException if a record already exists for this (classId, studentId, lessonDate).
   */
  async createTalmidautAndUpsertFinalGrade(
    studentId: string,
    classId: string,
    input: CreateTalmidautInput,
    finalGradeData: { fitnessAvg: number; talmidautAvg: number; recommendedGrade: number },
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.talmidautRecord.create({
          data: {
            studentId,
            classId,
            participation: input.participation,
            uniform: input.uniform,
            behavior: input.behavior,
            notes: input.notes,
            ...(input.lessonDate !== undefined ? { lessonDate: input.lessonDate } : {}),
          },
        });
        await tx.studentFinalGrade.upsert({
          where: { classId_studentId: { classId, studentId } },
          create: { classId, studentId, ...finalGradeData },
          update: finalGradeData,
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('כבר קיים רישום תלמידאות לתלמיד זה בשיעור זה');
      }
      throw e;
    }
  }

  /**
   * Loads the raw inputs required to compute the recommended final grade.
   * The caller (service layer) performs the arithmetic.
   */
  async findGradeComponents(
    studentId: string,
    classId: string,
  ): Promise<RawGradeComponents> {
    const [cls, testResults, talmidautRecords] = await Promise.all([
      this.prisma.class.findFirstOrThrow({
        where: { id: classId, deletedAt: null },
        select: { testWeight: true, talmidautWeight: true },
      }),
      this.prisma.testResult.findMany({
        where: { studentId, session: { classId } },
        select: { calculatedGrade: true, gradeOverride: true, session: { select: { testTypeId: true } } },
      }).then((rows) => rows.map((r) => ({ ...r, testTypeId: r.session.testTypeId }))),
      this.prisma.talmidautRecord.findMany({
        where: { studentId, classId },
        select: { participation: true, uniform: true, behavior: true },
      }),
    ]);

    return { cls, testResults, talmidautRecords };
  }

  /**
   * Returns the teacher's global default grading weights.
   * Used as the fallback when a class has no per-class weight override.
   */
  async findTeacherWeightDefaults(
    teacherId: string,
  ): Promise<{ defaultFitnessWeight: number; defaultConductWeight: number }> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: teacherId },
      select: { defaultFitnessWeight: true, defaultConductWeight: true },
    });
  }

  /**
   * Persists the computed final grade breakdown into StudentFinalGrade.
   * All arithmetic is performed by the caller (service layer).
   */
  async upsertFinalGrade(
    studentId: string,
    classId: string,
    data: { fitnessAvg: number; talmidautAvg: number; recommendedGrade: number },
  ): Promise<void> {
    await this.prisma.studentFinalGrade.upsert({
      where: { classId_studentId: { classId, studentId } },
      create: { classId, studentId, ...data },
      update: data,
    });
  }

  /**
   * Loads all raw data required to build a formal student report in one round-trip.
   *
   * Five parallel queries:
   *  1. Student + class metadata
   *  2. Student's test results for the class (semester-filtered when provided)
   *  3. Attendance counts grouped by status (single query)
   *  4. All class-wide test results for benchmark averages (semester-filtered)
   *  5. Talmidaut records for final-grade calculation
   *
   * Throws NotFoundException if the student does not exist.
   */
  async findReportData(
    studentId: string,
    classId: string,
    semester?: Semester,
  ): Promise<RawReportData> {
    const semesterFilter = semester !== undefined ? { semester } : {};

    const [studentAndClass, studentResults, rawAttendance, classResults, talmidautRecords] =
      await Promise.all([
        // ── 1. Student + class in a single join ────────────────────────────────
        this.prisma.classEnrollment.findFirst({
          where: { studentId, classId, student: { deletedAt: null } },
          select: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                gender: true,
                dateOfBirth: true,
                studentCode: true,
              },
            },
            class: {
              select: {
                name: true,
                gradeLevel: true,
                testWeight: true,
                talmidautWeight: true,
              },
            },
          },
        }),

        // ── 2. Student's own test results ──────────────────────────────────────
        this.prisma.testResult.findMany({
          where: {
            studentId,
            session: { classId, ...semesterFilter },
          },
          select: {
            rawValue: true,
            calculatedGrade: true,
            gradeOverride: true,
            session: {
              select: {
                testTypeId: true,
                conductedAt: true,
                testType: { select: { nameHe: true, unit: true, inputType: true } },
              },
            },
          },
          orderBy: { session: { conductedAt: 'asc' } },
        }),

        // ── 3. Attendance counts — one query via groupBy ───────────────────────
        this.prisma.attendanceRecord.groupBy({
          by: ['status'],
          where: { studentId, classId, ...semesterFilter },
          // eslint-disable-next-line @typescript-eslint/naming-convention
          _count: { status: true },
        }),

        // ── 4. Class-wide results for benchmark averages ───────────────────────
        this.prisma.testResult.findMany({
          where: {
            session: { classId, ...semesterFilter },
          },
          select: {
            calculatedGrade: true,
            gradeOverride: true,
            session: { select: { testTypeId: true } },
          },
        }),

        // ── 5. Talmidaut records — NOT semester-filtered by design ────────────
        // TalmidautRecord has no semester column; the entire year's talmidaut
        // average is always included in every semester view (as per spec).
        this.prisma.talmidautRecord.findMany({
          where: { studentId, classId },
          select: { participation: true, uniform: true, behavior: true },
        }),
      ]);

    if (studentAndClass === null) {
      throw new NotFoundException(`תלמיד ${studentId} אינו רשום לכיתה זו`);
    }

    // Collapse groupBy rows into a plain Record<status, count>
    const attendanceCounts: Record<string, number> = {};
    for (const row of rawAttendance) {
      attendanceCounts[row.status] = row._count.status;
    }

    return {
      student: studentAndClass.student,
      cls: studentAndClass.class,
      studentResults,
      attendanceCounts,
      classResults,
      talmidautRecords,
    };
  }

  /**
   * Creates a student and their class enrollment in a single transaction.
   * Throws ConflictException if the studentCode is already used in this class.
   */
  async createWithEnrollment(
    classId: string,
    input: CreateStudentInput,
  ): Promise<StudentResponseDto> {
    // Check studentCode uniqueness within this class before writing
    const conflict = await this.prisma.classEnrollment.findFirst({
      where: { classId, student: { studentCode: input.studentCode } },
      select: { id: true },
    });
    if (conflict !== null) {
      throw new ConflictException(
        `קוד תלמיד "${input.studentCode}" כבר קיים בכיתה זו`,
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient): Promise<StudentResponseDto> => {
          const student = await tx.student.create({
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              dateOfBirth: input.dateOfBirth,
              gender: input.gender,
              studentCode: input.studentCode,
              passwordHash: input.passwordHash,
            },
            select: STUDENT_SELECT,
          });

          await tx.classEnrollment.create({
            data: { classId, studentId: student.id, studentCode: input.studentCode },
          });

          return student;
        },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          `קוד תלמיד "${input.studentCode}" כבר קיים בכיתה זו`,
        );
      }
      throw e;
    }
  }
}
