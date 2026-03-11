import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, Gender, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StudentResponseDto } from './dto/student-response.dto';

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

/** Class weight fields returned alongside profile data. */
export interface ClassWeights {
  testWeight: number;
  talmidautWeight: number;
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
      where: { id: classId, teacherId },
      select: { id: true },
    });
    if (cls === null) {
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
  }

  /**
   * Returns all students enrolled in a class, ordered alphabetically by last name.
   */
  async findByClassId(classId: string): Promise<StudentResponseDto[]> {
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId },
      select: { student: { select: STUDENT_SELECT } },
      orderBy: { student: { lastName: 'asc' } },
    });
    return enrollments.map((e) => e.student);
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
   * Throws NotFoundException if the student doesn't exist.
   */
  async findRawStudentProfile(
    studentId: string,
    classId: string,
  ): Promise<RawStudentProfile> {
    const [student, results, attendanceTotal, attendancePresent, recentAttendance, talmidautRecords, classData] =
      await Promise.all([
        this.prisma.student.findUnique({
          where: { id: studentId },
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
          where: { studentId, session: { classId } },
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
        this.prisma.attendanceRecord.count({ where: { studentId, classId } }),
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
        this.prisma.class.findUniqueOrThrow({
          where: { id: classId },
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
      classWeights: { testWeight: classData.testWeight, talmidautWeight: classData.talmidautWeight },
    };
  }

  /**
   * Creates a new TalmidautRecord and recomputes the StudentFinalGrade.
   * Returns the updated final grade breakdown.
   */
  async createTalmidautRecord(
    studentId: string,
    classId: string,
    input: CreateTalmidautInput,
  ): Promise<FinalGradeResult> {
    await this.prisma.talmidautRecord.create({
      data: {
        studentId,
        classId,
        participation: input.participation,
        uniform: input.uniform,
        behavior: input.behavior,
        notes: input.notes,
      },
    });

    return this.recalculateFinalGrade(studentId, classId);
  }

  /**
   * Recomputes the recommended final grade from all talmidaut records and test results,
   * then upserts the StudentFinalGrade row.
   */
  async recalculateFinalGrade(
    studentId: string,
    classId: string,
  ): Promise<FinalGradeResult> {
    const [cls, testResults, talmidautRecords] = await Promise.all([
      this.prisma.class.findUniqueOrThrow({
        where: { id: classId },
        select: { testWeight: true, talmidautWeight: true },
      }),
      this.prisma.testResult.findMany({
        where: { studentId, session: { classId } },
        select: { calculatedGrade: true, gradeOverride: true },
      }),
      this.prisma.talmidautRecord.findMany({
        where: { studentId, classId },
        select: { participation: true, uniform: true, behavior: true },
      }),
    ]);

    const fitnessAvg =
      testResults.length > 0
        ? Math.round(
            testResults.reduce((s, r) => s + (r.gradeOverride ?? r.calculatedGrade ?? 0), 0) /
              testResults.length,
          )
        : 0;

    const talmidautAvg =
      talmidautRecords.length > 0
        ? Math.round(
            talmidautRecords.reduce((s, r) => s + (r.participation + r.uniform + r.behavior) / 3, 0) /
              talmidautRecords.length,
          )
        : 0;

    const recommendedGrade = Math.round(
      fitnessAvg * (cls.testWeight / 100) + talmidautAvg * (cls.talmidautWeight / 100),
    );

    await this.prisma.studentFinalGrade.upsert({
      where: { classId_studentId: { classId, studentId } },
      create: { classId, studentId, fitnessAvg, talmidautAvg, recommendedGrade },
      update: { fitnessAvg, talmidautAvg, recommendedGrade },
    });

    return {
      fitnessAvg,
      talmidautAvg,
      recommendedGrade,
      testWeight: cls.testWeight,
      talmidautWeight: cls.talmidautWeight,
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

    return this.prisma.$transaction(
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
          data: { classId, studentId: student.id },
        });

        return student;
      },
    );
  }
}
