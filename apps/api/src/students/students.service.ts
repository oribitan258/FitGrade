import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { StudentsRepository } from './students.repository';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { StudentResponseDto } from './dto/student-response.dto';
import type { StudentProfileResponseDto, StudentTestHistoryDto } from './dto/student-profile-response.dto';

/** Hebrew month labels for building per-student history points. */
const HEBREW_MONTH_LABELS: Record<number, string> = {
  1: "ינו'", 2: "פבר'", 3: "מרץ",   4: "אפר'",
  5: "מאי",  6: "יוני", 7: "יולי", 8: "אוג'",
  9: "ספט'", 10: "אוק'", 11: "נוב'", 12: "דצמ'",
};

/** bcrypt work factor — 12 rounds is the recommended minimum for 2024. */
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private readonly studentsRepository: StudentsRepository) {}

  /**
   * Returns all students enrolled in the given class.
   * Verifies the class belongs to the teacher before querying.
   */
  async getStudentsByClass(
    classId: string,
    teacherId: string,
  ): Promise<StudentResponseDto[]> {
    await this.studentsRepository.verifyClassOwnership(classId, teacherId);
    return this.studentsRepository.findByClassId(classId);
  }

  /**
   * Returns the full profile for a single student within a class.
   * Includes per-test history (scores over time) and attendance metrics.
   *
   * - Verifies the class belongs to the teacher (ownership check).
   * - Verifies the student is enrolled in that class.
   * - Aggregates test results into per-test history arrays.
   */
  async getStudentProfile(
    studentId: string,
    classId: string,
    teacherId: string,
  ): Promise<StudentProfileResponseDto> {
    await this.studentsRepository.verifyClassOwnership(classId, teacherId);
    await this.studentsRepository.verifyStudentInClass(studentId, classId);

    const { student, results, attendanceTotal, attendancePresent, recentAttendance } =
      await this.studentsRepository.findRawStudentProfile(studentId, classId);

    const attendancePct =
      attendanceTotal > 0
        ? Math.round((attendancePresent / attendanceTotal) * 100)
        : 0;

    // Map attendance records → 100 (present) or 0 (absent/late/excused)
    const attendanceTrend = recentAttendance.map((r) =>
      r.status === 'PRESENT' ? 100 : 0,
    );

    // ── Group results by test type, preserving chronological order ────────────
    interface TestAcc {
      nameHe: string;
      unit: string | null;
      history: { month: string; grade: number }[];
    }

    const testMap = new Map<string, TestAcc>();

    for (const result of results) {
      const { testTypeId, conductedAt, testType } = result.session;
      const grade = result.gradeOverride ?? result.calculatedGrade ?? 0;
      const month = HEBREW_MONTH_LABELS[conductedAt.getMonth() + 1] ?? '';

      if (!testMap.has(testTypeId)) {
        testMap.set(testTypeId, {
          nameHe: testType.nameHe,
          unit: testType.unit,
          history: [],
        });
      }
      testMap.get(testTypeId)!.history.push({ month, grade });
    }

    // ── Build testHistories ────────────────────────────────────────────────────
    const testHistories: StudentTestHistoryDto[] = [...testMap.entries()].map(
      ([testTypeId, acc]) => {
        const latestGrade =
          acc.history.length > 0
            ? acc.history[acc.history.length - 1]!.grade
            : 0;
        return { testTypeId, nameHe: acc.nameHe, unit: acc.unit, latestGrade, history: acc.history };
      },
    );

    const overallAvg =
      testHistories.length > 0
        ? Math.round(
            testHistories.reduce((s, t) => s + t.latestGrade, 0) /
              testHistories.length,
          )
        : 0;

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      studentCode: student.studentCode,
      attendancePct,
      attendanceTrend,
      overallAvg,
      testHistories,
    };
  }

  /**
   * Creates a new student and enrolls them in the given class.
   *
   * - Verifies the class belongs to the teacher.
   * - Hashes the password with bcrypt before storage.
   * - Enforces studentCode uniqueness within the class.
   * - Creates the Student row and ClassEnrollment in a single transaction.
   */
  async addStudentToClass(
    classId: string,
    dto: CreateStudentDto,
    teacherId: string,
  ): Promise<StudentResponseDto> {
    await this.studentsRepository.verifyClassOwnership(classId, teacherId);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const student = await this.studentsRepository.createWithEnrollment(
      classId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        studentCode: dto.studentCode,
        passwordHash,
      },
    );

    this.logger.log(
      `Student created: id=${student.id} code=${dto.studentCode} class=${classId}`,
    );

    return student;
  }
}
