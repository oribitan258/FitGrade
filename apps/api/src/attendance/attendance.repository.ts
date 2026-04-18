import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AttendanceStatus, Semester } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AttendanceResponseDto } from './dto/attendance-response.dto';

const ATTENDANCE_SELECT = {
  id: true,
  classId: true,
  studentId: true,
  date: true,
  status: true,
  notes: true,
  exemptionReason: true,
  exemptionExpiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies the class exists and belongs to the given teacher.
   * Throws NotFoundException if not found.
   */
  async verifyClassOwnership(classId: string, teacherId: string): Promise<void> {
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
   * Returns all attendance records for a class on a specific date.
   * When activeOnly=true, returns only EXCUSED records that have not expired
   * (exemptionExpiresAt is null OR exemptionExpiresAt >= now).
   * Results are ordered alphabetically by student last name.
   */
  async findByClassAndDate(
    classId: string,
    date: Date,
    activeOnly = false,
  ): Promise<AttendanceResponseDto[]> {
    const now = new Date();
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        classId,
        date,
        ...(activeOnly
          ? {
              status: 'EXCUSED',
              OR: [
                { exemptionExpiresAt: null },
                { exemptionExpiresAt: { gte: now } },
              ],
            }
          : {}),
      },
      select: ATTENDANCE_SELECT,
      orderBy: { student: { lastName: 'asc' } },
    });
    return records.map((r) => ({
      ...r,
      date: r.date.toISOString(),
      exemptionExpiresAt: r.exemptionExpiresAt?.toISOString() ?? null,
    }));
  }

  /**
   * Upserts attendance records for a class on a given date in a single transaction.
   * Uses @@unique([classId, studentId, date]) as the upsert key.
   * Returns the full list of records for the date after saving.
   */
  async upsertMany(
    classId: string,
    date: Date,
    records: Array<{
      studentId: string;
      status: AttendanceStatus;
      notes?: string;
      exemptionReason?: string;
      exemptionExpiresAt?: Date;
    }>,
    semester: Semester = 'A',
  ): Promise<AttendanceResponseDto[]> {
    await this.prisma.$transaction(
      records.map((r) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            classId_studentId_date: { classId, studentId: r.studentId, date },
          },
          create: {
            classId,
            studentId: r.studentId,
            date,
            semester,
            status: r.status,
            notes: r.notes,
            exemptionReason: r.exemptionReason,
            exemptionExpiresAt: r.exemptionExpiresAt,
          },
          update: {
            semester,
            status: r.status,
            notes: r.notes,
            exemptionReason: r.exemptionReason ?? null,
            exemptionExpiresAt: r.exemptionExpiresAt ?? null,
          },
        }),
      ),
    );
    return this.findByClassAndDate(classId, date);
  }
}
