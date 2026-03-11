import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  StudentAttendanceSummaryDto,
  StudentResultDto,
} from './dto/student-portal.dto';

@Injectable()
export class StudentPortalRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates all attendance records for the given student.
   * Returns per-status counts and the full record list (newest first).
   */
  async findAttendanceSummary(studentId: string): Promise<StudentAttendanceSummaryDto> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId },
      select: { date: true, status: true },
      orderBy: { date: 'desc' },
    });

    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of records) {
      const key = r.status.toLowerCase() as keyof typeof counts;
      counts[key]++;
    }

    return {
      ...counts,
      total: records.length,
      records: records.map((r) => ({
        date: r.date.toISOString().split('T')[0]!,
        status: r.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
      })),
    };
  }

  /**
   * Returns all test results for the given student, enriched with session date
   * and Hebrew test type name. Ordered newest-first.
   */
  async findResults(studentId: string): Promise<StudentResultDto[]> {
    const rows = await this.prisma.testResult.findMany({
      where: { studentId },
      select: {
        id: true,
        rawValue: true,
        calculatedGrade: true,
        gradeOverride: true,
        session: {
          select: {
            conductedAt: true,
            testType: { select: { nameHe: true, inputType: true } },
          },
        },
      },
      orderBy: { session: { conductedAt: 'desc' } },
    });

    return rows.map((row) => ({
      id: row.id,
      sessionDate: row.session.conductedAt.toISOString(),
      testNameHe: row.session.testType.nameHe,
      inputType: row.session.testType.inputType,
      rawValue: Number(row.rawValue ?? 0),
      effectiveGrade: row.gradeOverride ?? row.calculatedGrade ?? 0,
    }));
  }
}
