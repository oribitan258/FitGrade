import { Injectable, NotFoundException } from '@nestjs/common';
import type { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AttendanceResponseDto } from './dto/attendance-response.dto';

const ATTENDANCE_SELECT = {
  id: true,
  classId: true,
  studentId: true,
  date: true,
  status: true,
  notes: true,
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
      where: { id: classId, teacherId },
      select: { id: true },
    });
    if (cls === null) {
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
  }

  /**
   * Returns all attendance records for a class on a specific date.
   * Results are ordered alphabetically by student last name.
   */
  async findByClassAndDate(
    classId: string,
    date: Date,
  ): Promise<AttendanceResponseDto[]> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { classId, date },
      select: ATTENDANCE_SELECT,
      orderBy: { student: { lastName: 'asc' } },
    });
    return records.map((r) => ({ ...r, date: r.date.toISOString() }));
  }

  /**
   * Upserts attendance records for a class on a given date in a single transaction.
   * Uses @@unique([classId, studentId, date]) as the upsert key.
   * Returns the full list of records for the date after saving.
   */
  async upsertMany(
    classId: string,
    date: Date,
    records: Array<{ studentId: string; status: AttendanceStatus; notes?: string }>,
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
            status: r.status,
            notes: r.notes,
          },
          update: { status: r.status, notes: r.notes },
        }),
      ),
    );
    return this.findByClassAndDate(classId, date);
  }
}
