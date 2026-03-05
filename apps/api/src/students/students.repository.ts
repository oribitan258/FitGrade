import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StudentResponseDto } from './dto/student-response.dto';

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
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
