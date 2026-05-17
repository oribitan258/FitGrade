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
    dateOfBirth: Date | null;
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
    dateOfBirth: Date | null;
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
  gender: Gender;
  studentCode: string;
  nationalId: string;
  passwordHash?: string;
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
  nationalId: true,
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
        this.prisma.attendanceRecord.count({
          where: { studentId, classId, status: { not: 'EXCUSED' }, ...(semester !== undefined ? { semester } : {}) },
        }),
        this.prisma.attendanceRecord.count({
          where: { studentId, classId, status: 'PRESENT', ...(semester !== undefined ? { semester } : {}) },
        }),
        this.prisma.attendanceRecord.findMany({
          where: { studentId, classId, ...(semester !== undefined ? { semester } : {}) },
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

  /** Returns the gender composition type for a class. Used for gender-class validation. */
  async findClassGenderType(classId: string): Promise<'BOYS' | 'GIRLS' | 'MIXED'> {
    const cls = await this.prisma.class.findUniqueOrThrow({
      where: { id: classId },
      select: { genderType: true },
    });
    return cls.genderType;
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
   * Enrolls a student in a class with smart upsert logic:
   *   - If nationalId matches an existing student who is already in this class → 409 Conflict
   *   - If nationalId matches an existing student in a different class → re-enrolls (new ClassEnrollment)
   *   - Otherwise → creates a new Student + ClassEnrollment
   *
   * Returns the student DTO plus a reEnrolled flag. When reEnrolled is true,
   * studentName is also returned so the caller can inform the teacher.
   */
  async enrollStudent(
    classId: string,
    input: CreateStudentInput,
  ): Promise<{ student: StudentResponseDto; reEnrolled: false }> {
    // Check for existing student by nationalId before entering the transaction
    if (input.nationalId) {
      const existing = await this.prisma.student.findUnique({
        where: { nationalId: input.nationalId },
        select: { id: true, firstName: true, lastName: true },
      });

      if (existing !== null) {
        const enrollment = await this.prisma.classEnrollment.findUnique({
          where: { classId_studentId: { classId, studentId: existing.id } },
          select: { id: true },
        });

        if (enrollment !== null) {
          throw new ConflictException('התלמיד כבר רשום לכיתה זו');
        }

        throw new ConflictException('התלמיד כבר רשום לכיתה אחרת במערכת. תלמיד לא יכול להיות בשתי כיתות במקביל');
      }
    }

    // New student — create + enroll in one transaction
    try {
      const student = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient): Promise<StudentResponseDto> => {
          const created = await tx.student.create({
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              gender: input.gender,
              studentCode: input.studentCode,
              ...(input.nationalId ? { nationalId: input.nationalId } : {}),
              ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
            },
            select: STUDENT_SELECT,
          });

          await tx.classEnrollment.create({
            data: { classId, studentId: created.id, studentCode: input.studentCode },
          });

          return created;
        },
      );

      return { student, reEnrolled: false };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('תלמיד עם תעודת זהות זו כבר קיים במערכת');
      }
      throw e;
    }
  }

  /**
   * Bulk-imports students from a parsed roster into the given class.
   *
   * Replaces the previous per-row serial loop (N×4 queries inside one long
   * transaction) with 5 fixed queries regardless of roster size. (STAB-004)
   *
   * Query plan:
   *   1. findMany — existing students by nationalId (pre-fetch)
   *   2. findMany — existing enrollments for this class (pre-fetch)
   *   3. createMany — new students (skipDuplicates for concurrent-import safety)
   *   4. findMany  — re-fetch newly created students to get their IDs
   *   5. createMany — new enrollments for all unenrolled students
   *
   * All 5 queries run inside a single $transaction for atomicity.
   * The transaction is short-lived (no awaits inside a loop) so it never
   * holds the connection long enough to exhaust the pool.
   */
  async importStudents(
    classId: string,
    rows: Array<{ nationalId: string; firstName: string; lastName: string; gender: 'MALE' | 'FEMALE' | null }>,
  ): Promise<{ added: number; existing: number; reEnrolled: number }> {
    if (rows.length === 0) return { added: 0, existing: 0, reEnrolled: 0 };

    const nationalIds = rows.map((r) => r.nationalId);

    return this.prisma.$transaction(async (tx) => {
      // ── 1. Pre-fetch: which students already exist in the DB? ──────────────
      const existingStudents = await tx.student.findMany({
        where: { nationalId: { in: nationalIds } },
        select: { id: true, nationalId: true },
      });
      const existingByNationalId = new Map(existingStudents.map((s) => [s.nationalId, s.id]));

      // ── 2. Pre-fetch: which of those students are already enrolled here? ──
      const existingEnrollments = existingStudents.length > 0
        ? await tx.classEnrollment.findMany({
            where: {
              classId,
              studentId: { in: existingStudents.map((s) => s.id) },
            },
            select: { studentId: true },
          })
        : [];
      const enrolledStudentIds = new Set(existingEnrollments.map((e) => e.studentId));

      // ── 3. Create all brand-new students in one batch ─────────────────────
      const newStudentRows = rows.filter((r) => !existingByNationalId.has(r.nationalId));
      if (newStudentRows.length > 0) {
        await tx.student.createMany({
          data: newStudentRows.map((r) => ({
            firstName:   r.firstName,
            lastName:    r.lastName,
            gender:      (r.gender ?? 'MALE') as Gender,
            nationalId:  r.nationalId,
            studentCode: r.nationalId.slice(-4),
          })),
          skipDuplicates: true,
        });
      }

      // ── 4. Re-fetch IDs for the batch we just created ─────────────────────
      const createdStudents = newStudentRows.length > 0
        ? await tx.student.findMany({
            where: { nationalId: { in: newStudentRows.map((r) => r.nationalId) } },
            select: { id: true, nationalId: true },
          })
        : [];

      // Build a complete nationalId → studentId map covering all rows
      const allById = new Map([
        ...existingByNationalId,
        ...createdStudents.map((s) => [s.nationalId, s.id] as [string, string]),
      ]);

      // ── 5. Create all missing enrollments in one batch ────────────────────
      const toEnroll = rows.filter((r) => {
        const sid = allById.get(r.nationalId);
        return sid !== undefined && !enrolledStudentIds.has(sid);
      });

      if (toEnroll.length > 0) {
        await tx.classEnrollment.createMany({
          data: toEnroll.map((r) => ({
            classId,
            // sid is guaranteed non-null: toEnroll filter confirmed allById.get() !== undefined
            studentId:   allById.get(r.nationalId)!,
            studentCode: r.nationalId.slice(-4),
          })),
          skipDuplicates: true,
        });
      }

      // ── Compute counters ──────────────────────────────────────────────────
      const added      = toEnroll.filter((r) => !existingByNationalId.has(r.nationalId)).length;
      const reEnrolled = toEnroll.filter((r) =>  existingByNationalId.has(r.nationalId)).length;
      const existing   = rows.length - added - reEnrolled;

      return { added, existing, reEnrolled };
    });
  }
}
