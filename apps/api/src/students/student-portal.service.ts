import { Injectable, Logger } from '@nestjs/common';
import { StudentPortalRepository } from './student-portal.repository';
import type { StudentAttendanceSummaryDto, StudentResultDto } from './dto/student-portal.dto';

@Injectable()
export class StudentPortalService {
  private readonly logger = new Logger(StudentPortalService.name);

  constructor(private readonly studentPortalRepository: StudentPortalRepository) {}

  /**
   * Returns attendance summary for the authenticated student.
   * The studentId comes directly from the validated JWT — no additional
   * ownership check is needed because jwtPayload.sub IS the student's own ID.
   */
  async getMyAttendance(studentId: string): Promise<StudentAttendanceSummaryDto> {
    const summary = await this.studentPortalRepository.findAttendanceSummary(studentId);
    this.logger.log(`Attendance fetched for student=${studentId} total=${summary.total}`);
    return summary;
  }

  /** Returns all test results for the authenticated student. */
  async getMyResults(studentId: string): Promise<StudentResultDto[]> {
    const results = await this.studentPortalRepository.findResults(studentId);
    this.logger.log(`Results fetched for student=${studentId} count=${results.length}`);
    return results;
  }
}
