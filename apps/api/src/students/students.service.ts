import { Injectable, Logger } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import type { Semester } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { StudentsRepository } from './students.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { CreateTalmidautDto } from './dto/create-talmidaut.dto';
import type { StudentResponseDto } from './dto/student-response.dto';
import type {
  FinalGradeDto,
  StudentProfileResponseDto,
  StudentTestHistoryDto,
  TalmidautRecordDto,
} from './dto/student-profile-response.dto';
import type {
  ReportAttendanceDto,
  ReportTestResultDto,
  StudentReportResponseDto,
} from './dto/student-report-response.dto';
import type { FinalGradeResult, RawGradeComponents } from './students.repository';

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

  constructor(
    private readonly studentsRepository: StudentsRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

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
   * Includes per-test history (scores over time), attendance metrics,
   * talmidaut records, and calculated final grade.
   *
   * - Verifies the class belongs to the teacher (ownership check).
   * - Verifies the student is enrolled in that class.
   * - Aggregates test results into per-test history arrays.
   */
  async getStudentProfile(
    studentId: string,
    classId: string,
    teacherId: string,
    semester?: Semester,
  ): Promise<StudentProfileResponseDto> {
    await this.studentsRepository.verifyClassOwnership(classId, teacherId);
    await this.studentsRepository.verifyStudentInClass(studentId, classId);

    const { student, results, attendanceTotal, attendancePresent, recentAttendance, talmidautRecords, classWeights } =
      await this.studentsRepository.findRawStudentProfile(studentId, classId, semester);

    const attendancePct =
      attendanceTotal > 0
        ? Math.round((attendancePresent / attendanceTotal) * 100)
        : 0;

    // Map attendance records → 100 (present) or 0 (absent/late).
    // EXCUSED records are excluded — they don't represent actual attendance performance
    // and must not artificially lower the trend chart toward 0.
    const attendanceTrend = recentAttendance
      .filter((r) => r.status !== 'EXCUSED')
      .map((r) => (r.status === 'PRESENT' ? 100 : 0));

    // ── Group results by test type, preserving chronological order ────────────
    interface TestAcc {
      nameHe: string;
      unit: string | null;
      inputType: string;
      // Most recent effective grade (last-write-wins: results ordered oldest→newest)
      latestGrade: number;
      // Best grade across all sessions for this test type (used for avg, matches report logic)
      bestGrade: number;
      latestRawValue: number | null;
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
          inputType: testType.inputType,
          latestGrade: 0,
          bestGrade: 0,
          latestRawValue: null,
          history: [],
        });
      }
      const acc = testMap.get(testTypeId)!;
      acc.history.push({ month, grade });
      // Always overwrite: results are ordered oldest→newest, so the last wins = most recent
      acc.latestGrade = grade;
      acc.bestGrade = Math.max(acc.bestGrade, grade);
      acc.latestRawValue = result.rawValue !== null ? Number(result.rawValue) : null;
    }

    // ── Build testHistories ────────────────────────────────────────────────────
    const testHistories: StudentTestHistoryDto[] = [...testMap.entries()].map(
      ([testTypeId, acc]) => ({
        testTypeId,
        nameHe: acc.nameHe,
        unit: acc.unit,
        inputType: acc.inputType,
        latestGrade: acc.latestGrade,
        latestRawValue: acc.latestRawValue,
        history: acc.history,
      }),
    );

    // Best-grade average — matches getStudentReport strategy for consistency
    const overallAvg =
      testMap.size > 0
        ? Math.round(
            [...testMap.values()].reduce((s, t) => s + t.bestGrade, 0) /
              testMap.size,
          )
        : 0;

    // ── Build talmidaut records DTO ────────────────────────────────────────────
    const talmidautDtos: TalmidautRecordDto[] = talmidautRecords.map((r) => ({
      id: r.id,
      participation: r.participation,
      uniform: r.uniform,
      behavior: r.behavior,
      compositeScore: Math.round((r.participation + r.uniform + r.behavior) / 3),
      notes: r.notes,
      recordedAt: r.recordedAt.toISOString(),
    }));

    // ── Compute recommended final grade ───────────────────────────────────────
    const talmidautAvg =
      talmidautRecords.length > 0
        ? Math.round(
            talmidautRecords.reduce(
              (s, r) => s + (r.participation + r.uniform + r.behavior) / 3,
              0,
            ) / talmidautRecords.length,
          )
        : 0;

    let effectiveTestWeight: number;
    let effectiveTalmidautWeight: number;
    if (classWeights.testWeight !== null && classWeights.talmidautWeight !== null) {
      effectiveTestWeight = classWeights.testWeight;
      effectiveTalmidautWeight = classWeights.talmidautWeight;
    } else {
      const teacherDefaults = await this.studentsRepository.findTeacherWeightDefaults(teacherId);
      effectiveTestWeight = teacherDefaults.defaultFitnessWeight;
      effectiveTalmidautWeight = teacherDefaults.defaultConductWeight;
    }

    const recommendedGrade = Math.round(
      overallAvg * (effectiveTestWeight / 100) +
        talmidautAvg * (effectiveTalmidautWeight / 100),
    );

    const finalGrade: FinalGradeDto = {
      fitnessAvg: overallAvg,
      talmidautAvg,
      recommendedGrade,
      testWeight: effectiveTestWeight,
      talmidautWeight: effectiveTalmidautWeight,
    };

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
      talmidautRecords: talmidautDtos,
      finalGrade,
    };
  }

  /**
   * Builds a formal student report for the given class + optional semester.
   *
   * - Verifies class ownership and student enrollment.
   * - Aggregates test results, attendance, class benchmarks, and final grade
   *   in a single repository call (5 parallel DB queries, no N+1).
   * - Test results are sorted best-grade-first so PDF generators can present
   *   highlights at the top of the report.
   */
  async getStudentReport(
    studentId: string,
    classId: string,
    teacherId: string,
    semester?: Semester,
  ): Promise<StudentReportResponseDto> {
    await this.studentsRepository.verifyClassOwnership(classId, teacherId);
    await this.studentsRepository.verifyStudentInClass(studentId, classId);

    const { student, cls, studentResults, attendanceCounts, classResults, talmidautRecords } =
      await this.studentsRepository.findReportData(studentId, classId, semester);

    // ── Class-wide benchmark map: testTypeId → average effective grade ─────────
    interface BenchmarkAcc { sum: number; count: number }
    const benchmarkMap = new Map<string, BenchmarkAcc>();

    for (const r of classResults) {
      const grade = r.gradeOverride ?? r.calculatedGrade ?? 0;
      const testTypeId = r.session.testTypeId;
      const acc = benchmarkMap.get(testTypeId) ?? { sum: 0, count: 0 };
      acc.sum   += grade;
      acc.count += 1;
      benchmarkMap.set(testTypeId, acc);
    }

    const classAvgFor = (testTypeId: string): number => {
      const acc = benchmarkMap.get(testTypeId);
      if (!acc || acc.count === 0) return 0;
      return Math.round(acc.sum / acc.count);
    };

    // ── Group student results by testTypeId, tracking the best grade ──────────
    interface TestAcc {
      nameHe: string;
      unit: string | null;
      inputType: string;
      latestConductedAt: Date;
      bestGrade: number;
      latestRawValue: number | null;
      count: number;
    }

    const testMap = new Map<string, TestAcc>();

    // Results arrive oldest-first from the repository; track best grade seen.
    for (const r of studentResults) {
      const { testTypeId, conductedAt, testType } = r.session;
      const grade = r.gradeOverride ?? r.calculatedGrade ?? 0;

      const existing = testMap.get(testTypeId);
      testMap.set(testTypeId, {
        nameHe:            testType.nameHe,
        unit:              testType.unit,
        inputType:         testType.inputType,
        latestConductedAt: conductedAt,
        bestGrade:         Math.max(existing?.bestGrade ?? 0, grade),
        latestRawValue:    r.rawValue !== null ? Number(r.rawValue) : null,
        count:             (existing?.count ?? 0) + 1,
      });
    }

    const testResults: ReportTestResultDto[] = [...testMap.entries()]
      .map(([testTypeId, acc]): ReportTestResultDto => ({
        testTypeId,
        nameHe:       acc.nameHe,
        unit:         acc.unit,
        inputType:    acc.inputType,
        conductedAt:  acc.latestConductedAt.toISOString(),
        grade:        acc.bestGrade,
        rawValue:     acc.latestRawValue,
        classAvg:     classAvgFor(testTypeId),
        sessionCount: acc.count,
      }));

    // ── Attendance ─────────────────────────────────────────────────────────────
    const present = attendanceCounts['PRESENT']  ?? 0;
    const absent  = attendanceCounts['ABSENT']   ?? 0;
    const excused = attendanceCounts['EXCUSED']  ?? 0;
    // Denominator excludes EXCUSED — excused absences do not penalise attendance %
    const total   = present + absent;

    const attendance: ReportAttendanceDto = {
      total,
      present,
      absent,
      excused,
      pct: total > 0 ? Math.round((present / total) * 100) : 0,
    };

    // ── Final grade ────────────────────────────────────────────────────────────
    const fitnessAvg =
      testResults.length > 0
        ? Math.round(testResults.reduce((s, t) => s + t.grade, 0) / testResults.length)
        : 0;

    const talmidautAvg =
      talmidautRecords.length > 0
        ? Math.round(
            talmidautRecords.reduce(
              (s, r) => s + (r.participation + r.uniform + r.behavior) / 3,
              0,
            ) / talmidautRecords.length,
          )
        : 0;

    let reportTestWeight: number;
    let reportTalmidautWeight: number;
    if (cls.testWeight !== null && cls.talmidautWeight !== null) {
      reportTestWeight = cls.testWeight;
      reportTalmidautWeight = cls.talmidautWeight;
    } else {
      const teacherDefaults = await this.studentsRepository.findTeacherWeightDefaults(teacherId);
      reportTestWeight = teacherDefaults.defaultFitnessWeight;
      reportTalmidautWeight = teacherDefaults.defaultConductWeight;
    }

    const finalGrade: FinalGradeDto = {
      fitnessAvg,
      talmidautAvg,
      recommendedGrade: Math.round(
        fitnessAvg   * (reportTestWeight     / 100) +
        talmidautAvg * (reportTalmidautWeight / 100),
      ),
      testWeight:      reportTestWeight,
      talmidautWeight: reportTalmidautWeight,
    };

    this.logger.log(
      `Report generated: student=${studentId} class=${classId} semester=${semester ?? 'all'} tests=${testResults.length}`,
    );

    return {
      studentId:   student.id,
      firstName:   student.firstName,
      lastName:    student.lastName,
      gender:      student.gender,
      dateOfBirth: student.dateOfBirth,
      studentCode: student.studentCode,
      className:   cls.name,
      gradeLevel:  cls.gradeLevel,
      semester:    semester ?? null,
      generatedAt: new Date().toISOString(),
      testResults,
      attendance,
      finalGrade,
    };
  }

  /**
   * Records a new talmidaut entry for a student in a class and atomically
   * recomputes the recommended final grade.
   *
   * - Verifies the class belongs to the teacher and student enrollment.
   * - Reads existing grade components before inserting the new record.
   * - Includes the new record in the grade computation (avoids a second DB round-trip).
   * - Atomically creates the TalmidautRecord and upserts StudentFinalGrade in one $transaction (BUG-021).
   * - Recommended grade is computed using only populated categories — a missing fitness
   *   average does not drag the grade toward 0 (BUG-022).
   */
  async addTalmidautRecord(
    studentId: string,
    classId: string,
    dto: CreateTalmidautDto,
    teacherId: string,
  ): Promise<FinalGradeResult> {
    await this.studentsRepository.verifyClassOwnership(classId, teacherId);
    await this.studentsRepository.verifyStudentInClass(studentId, classId);

    const { cls, testResults, talmidautRecords }: RawGradeComponents =
      await this.studentsRepository.findGradeComponents(studentId, classId);

    // ── Fitness avg (best grade per test type) ────────────────────────────────
    const gradesByTestType = new Map<string, number>();
    for (const r of testResults) {
      const effective = r.gradeOverride ?? r.calculatedGrade ?? 0;
      gradesByTestType.set(r.testTypeId, Math.max(gradesByTestType.get(r.testTypeId) ?? 0, effective));
    }
    const perTestBests = Array.from(gradesByTestType.values());
    const hasTests = perTestBests.length > 0;
    const fitnessAvg = hasTests
      ? Math.round(perTestBests.reduce((s, g) => s + g, 0) / perTestBests.length)
      : 0;

    // ── Talmidaut avg — include the new record being inserted ─────────────────
    const allTalmidautRecords = [
      ...talmidautRecords,
      { participation: dto.participation, uniform: dto.uniform, behavior: dto.behavior },
    ];
    const talmidautAvg = Math.round(
      allTalmidautRecords.reduce((s, r) => s + (r.participation + r.uniform + r.behavior) / 3, 0) /
        allTalmidautRecords.length,
    );

    // ── Weights ───────────────────────────────────────────────────────────────
    let effectiveTestWeight: number;
    let effectiveTalmidautWeight: number;
    if (cls.testWeight !== null && cls.talmidautWeight !== null) {
      effectiveTestWeight = cls.testWeight;
      effectiveTalmidautWeight = cls.talmidautWeight;
    } else {
      const teacherDefaults = await this.studentsRepository.findTeacherWeightDefaults(teacherId);
      effectiveTestWeight = teacherDefaults.defaultFitnessWeight;
      effectiveTalmidautWeight = teacherDefaults.defaultConductWeight;
    }

    // ── Recommended grade — only blend populated categories (BUG-022) ─────────
    const recommendedGrade = hasTests
      ? Math.round(fitnessAvg * (effectiveTestWeight / 100) + talmidautAvg * (effectiveTalmidautWeight / 100))
      : talmidautAvg;

    const lessonDate = dto.lessonDate !== undefined ? new Date(dto.lessonDate) : undefined;

    // ── Atomic write: create record + upsert final grade (BUG-021) ────────────
    await this.studentsRepository.createTalmidautAndUpsertFinalGrade(
      studentId,
      classId,
      { participation: dto.participation, uniform: dto.uniform, behavior: dto.behavior, notes: dto.notes, lessonDate },
      { fitnessAvg, talmidautAvg, recommendedGrade },
    );

    this.logger.log(
      `Talmidaut recorded: student=${studentId} class=${classId} composite=${Math.round((dto.participation + dto.uniform + dto.behavior) / 3)}`,
    );

    return {
      fitnessAvg,
      talmidautAvg,
      recommendedGrade,
      testWeight: effectiveTestWeight,
      talmidautWeight: effectiveTalmidautWeight,
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

    void this.auditLogService.log({
      action: AuditAction.STUDENT_ENROLLED,
      entityType: 'ClassEnrollment',
      entityId: student.id,
      actorId: teacherId,
      newValue: { classId, studentCode: dto.studentCode },
    });

    return student;
  }
}
