import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AttendanceStatus } from '@prisma/client';
import { AttendanceRepository } from './attendance.repository';
import type { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import type { AttendanceResponseDto } from './dto/attendance-response.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  /**
   * Returns all attendance records for a class on a given date.
   * Verifies the class belongs to the teacher before querying.
   */
  async getAttendance(
    classId: string,
    dateStr: string,
    teacherId: string,
    activeOnly = false,
  ): Promise<AttendanceResponseDto[]> {
    const date = this.parseDate(dateStr);
    await this.attendanceRepository.verifyClassOwnership(classId, teacherId);
    return this.attendanceRepository.findByClassAndDate(classId, date, activeOnly);
  }

  /**
   * Bulk-saves or updates attendance records for a class on a given date.
   * Existing records are updated; new records are created (upsert semantics).
   * Returns the full list of attendance records for the date after saving.
   */
  async saveAttendance(
    classId: string,
    dto: BulkAttendanceDto,
    teacherId: string,
  ): Promise<AttendanceResponseDto[]> {
    const date = this.parseDate(dto.date);
    await this.attendanceRepository.verifyClassOwnership(classId, teacherId);

    const records = dto.records.map((r) => ({
      studentId: r.studentId,
      status: r.status as AttendanceStatus,
      notes: r.notes,
      exemptionReason: r.exemptionReason,
      exemptionExpiresAt: r.exemptionExpiresAt ? new Date(r.exemptionExpiresAt) : undefined,
    }));

    const result = await this.attendanceRepository.upsertMany(classId, date, records, dto.semester);

    this.logger.log(
      `Attendance saved: class=${classId} date=${dto.date} records=${dto.records.length} teacher=${teacherId}`,
    );

    return result;
  }

  /**
   * Parses a YYYY-MM-DD date string into a Date object.
   * Throws BadRequestException if the string is not a valid date.
   */
  private parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('פורמט תאריך לא תקין — נדרש YYYY-MM-DD');
    }
    return date;
  }
}
