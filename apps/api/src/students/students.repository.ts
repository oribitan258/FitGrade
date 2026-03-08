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
  calculatedGrade: number | null;
  gradeOverride: number | null;
  session: {
    testTypeId: string;
    conductedAt: Date;
    testType: { nameHe: string; unit: string | null };
  };
}

/** Raw attendance row used by findRawStudentProfile. */
export interface RawAttendanceRow {
  status: AttendanceStatus;
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
}

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: Gender;
  studentCode: string;
  passwordHash: string; // pre-hashed by StudentsService
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
    const [student, results, attendanceTotal, attendancePresent, recentAttendance] =
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
      ]);

    if (student === null) {
      throw new NotFoundException(`תלמיד ${studentId} לא נמצא`);
    }

    return { student, results, attendanceTotal, attendancePresent, recentAttendance };
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
