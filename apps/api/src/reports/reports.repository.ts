import { Injectable } from '@nestjs/common';
import { AttendanceStatus, Semester } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Flat test result row for report aggregation. */
export interface RawReportResult {
  studentId: string;
  testTypeId: string;
  testNameHe: string;
  effectiveGrade: number; // gradeOverride ?? calculatedGrade ?? 0
}

/** Talmidaut composite score per student. */
export interface RawTalmidautSummary {
  studentId: string;
  compositeScores: number[];
}

/** Attendance counts per student (from groupBy). */
export interface RawAttendanceStat {
  studentId: string;
  status: AttendanceStatus;
  count: number;
}

/** Persisted teacher overrides from StudentFinalGrade. */
export interface RawFinalGradeOverride {
  studentId: string;
  teacherFinalGrade: number | null;
  verbalComment: string | null;
}

/** Minimal student record for report rows. */
export interface RawReportStudent {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  gender: string;
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies the class exists and belongs to the given teacher.
   * Returns the class name.
   */
  async verifyClassOwnership(classId: string, teacherId: string): Promise<{ name: string }> {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: { name: true },
    });
    if (cls === null) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
    return cls;
  }

  /**
   * Returns all students enrolled in the class, ordered by last name.
   * NOTE: We intentionally avoid `orderBy: { student: { lastName: 'asc' } }`
   * because Prisma implements relation-field ordering via an INNER JOIN, which
   * silently drops enrollment rows whose student record cannot be resolved.
   * Sorting in JavaScript guarantees ALL enrolled students always appear.
   */
  async findStudentsInClass(classId: string): Promise<RawReportStudent[]> {
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId },
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            gender: true,
          },
        },
      },
    });
    return enrollments
      .map((e) => ({
        id: e.student.id,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        studentCode: e.student.studentCode,
        gender: e.student.gender,
      }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'he'));
  }

  /**
   * Loads all test results for all students in a class in one query.
   * When `semester` is provided, only results from sessions in that semester are returned.
   * Returns flat rows with effectiveGrade already resolved.
   */
  async findAllTestResults(
    classId: string,
    studentIds: string[],
    semester?: Semester,
  ): Promise<RawReportResult[]> {
    if (studentIds.length === 0) return [];
    const semesterFilter = semester !== undefined ? { semester } : {};
    const results = await this.prisma.testResult.findMany({
      where: {
        studentId: { in: studentIds },
        session: { classId, ...semesterFilter },
        OR: [
          { calculatedGrade: { not: null } },
          { gradeOverride: { not: null } },
        ],
      },
      select: {
        studentId: true,
        calculatedGrade: true,
        gradeOverride: true,
        session: {
          select: {
            testTypeId: true,
            testType: { select: { nameHe: true } },
          },
        },
      },
    });

    return results.map((r) => ({
      studentId: r.studentId,
      testTypeId: r.session.testTypeId,
      testNameHe: r.session.testType.nameHe,
      effectiveGrade: r.gradeOverride ?? r.calculatedGrade ?? 0,
    }));
  }

  /**
   * Loads all talmidaut composite scores per student.
   * Returns a map of studentId → composite scores array.
   */
  async findAllTalmidautSummaries(
    classId: string,
    studentIds: string[],
  ): Promise<RawTalmidautSummary[]> {
    if (studentIds.length === 0) return [];
    const records = await this.prisma.talmidautRecord.findMany({
      where: { classId, studentId: { in: studentIds } },
      select: { studentId: true, participation: true, uniform: true, behavior: true },
    });

    const map = new Map<string, number[]>();
    for (const r of records) {
      const composite = Math.round((r.participation + r.uniform + r.behavior) / 3);
      const arr = map.get(r.studentId) ?? [];
      arr.push(composite);
      map.set(r.studentId, arr);
    }

    return studentIds.map((id) => ({
      studentId: id,
      compositeScores: map.get(id) ?? [],
    }));
  }

  /**
   * Returns per-student, per-status attendance counts via DB-level groupBy.
   * When `semester` is provided, only records from that semester are counted.
   */
  async findAttendanceStats(
    classId: string,
    studentIds: string[],
    semester?: Semester,
  ): Promise<RawAttendanceStat[]> {
    if (studentIds.length === 0) return [];
    const semesterFilter = semester !== undefined ? { semester } : {};
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: { classId, studentId: { in: studentIds }, ...semesterFilter },
      _count: { status: true },
    });

    return grouped.map((g) => ({
      studentId: g.studentId,
      status: g.status,
      count: g._count.status,
    }));
  }

  /**
   * Returns existing teacher overrides (teacherFinalGrade + verbalComment)
   * from the StudentFinalGrade table for all students in the class.
   */
  async findFinalGradeOverrides(
    classId: string,
    studentIds: string[],
  ): Promise<RawFinalGradeOverride[]> {
    if (studentIds.length === 0) return [];
    const records = await this.prisma.studentFinalGrade.findMany({
      where: { classId, studentId: { in: studentIds } },
      select: { studentId: true, teacherFinalGrade: true, verbalComment: true },
    });
    return records.map((r) => ({
      studentId: r.studentId,
      teacherFinalGrade: r.teacherFinalGrade,
      verbalComment: r.verbalComment,
    }));
  }

  /**
   * Saves teacher grade and comment overrides for multiple students at once.
   * Uses upsert per student so teachers can save partial lists.
   */
  async saveGradeOverrides(
    classId: string,
    overrides: Array<{
      studentId: string;
      teacherFinalGrade?: number;
      verbalComment?: string;
    }>,
  ): Promise<void> {
    await this.prisma.$transaction(
      overrides.map((o) =>
        this.prisma.studentFinalGrade.upsert({
          where: { classId_studentId: { classId, studentId: o.studentId } },
          create: {
            classId,
            studentId: o.studentId,
            fitnessAvg: 0,
            talmidautAvg: 0,
            recommendedGrade: 0,
            teacherFinalGrade: o.teacherFinalGrade ?? null,
            verbalComment: o.verbalComment ?? null,
          },
          update: {
            ...(o.teacherFinalGrade !== undefined && { teacherFinalGrade: o.teacherFinalGrade }),
            ...(o.verbalComment !== undefined && { verbalComment: o.verbalComment }),
          },
        }),
      ),
    );
  }

  /**
   * Counts how many TestSessions exist for a class in a specific semester.
   * Used as a pre-check: if 0 sessions exist we return an empty report rather
   * than leaking year-wide Talmidaut data into a semester with no test activity.
   */
  async countTestSessionsForSemester(classId: string, semester: Semester): Promise<number> {
    return this.prisma.testSession.count({
      where: { classId, semester },
    });
  }

  /**
   * Returns full attendance records for the attendance-tab report.
   */
  async findAttendanceReport(
    classId: string,
  ): Promise<Array<{
    studentId: string;
    firstName: string;
    lastName: string;
    date: Date;
    status: AttendanceStatus;
    exemptionReason: string | null;
  }>> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { classId },
      select: {
        studentId: true,
        date: true,
        status: true,
        exemptionReason: true,
        student: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { date: 'desc' }],
    });
    return records.map((r) => ({
      studentId: r.studentId,
      firstName: r.student.firstName,
      lastName: r.student.lastName,
      date: r.date,
      status: r.status,
      exemptionReason: r.exemptionReason,
    }));
  }
}
