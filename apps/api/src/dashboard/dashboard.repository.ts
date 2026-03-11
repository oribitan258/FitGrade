import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Grade threshold below which a student is flagged as "below norm". */
export const PASS_GRADE_THRESHOLD = 57;

/** Number of recent sessions to include in the dashboard response. */
const RECENT_SESSIONS_LIMIT = 5;

export interface RawResult {
  sessionClassId: string;
  studentId: string;
  calculatedGrade: number;
}

export interface ClassAttendanceStat {
  classId: string;
  total: number;
  present: number;
}

export interface RawSession {
  sessionId: string;
  classId: string;
  className: string;
  testNameHe: string;
  conductedAt: Date;
}

export interface ClassMeta {
  id: string;
  studentCount: number;
}

export interface MissingResultItem {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  sessionId: string;
  testNameHe: string;
  sessionDate: Date;
}

export interface BelowNormItem {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  testNameHe: string;
  score: number;
  normThreshold: number;
}

export interface RawTopStudent {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  avgGrade: number;
  resultCount: number;
  gender: string;
}

/** Maximum students returned by the top-students endpoint. */
export const TOP_STUDENTS_LIMIT = 20;

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all class IDs for the teacher with enrollment counts.
   */
  async findTeacherClassMeta(teacherId: string): Promise<ClassMeta[]> {
    const classes = await this.prisma.class.findMany({
      where: { teacherId },
      select: {
        id: true,
        _count: { select: { enrollments: true } },
      },
    });
    return classes.map((c) => ({
      id: c.id,
      studentCount: c._count.enrollments,
    }));
  }

  /**
   * Returns all test results for the teacher's classes.
   * Used for in-memory aggregation of fitness stats.
   */
  async findResultsForTeacher(classIds: string[]): Promise<RawResult[]> {
    if (classIds.length === 0) return [];
    const results = await this.prisma.testResult.findMany({
      where: { session: { classId: { in: classIds } } },
      select: {
        calculatedGrade: true,
        studentId: true,
        session: { select: { classId: true } },
      },
    });
    return results.map((r) => ({
      sessionClassId: r.session.classId,
      studentId: r.studentId,
      calculatedGrade: r.calculatedGrade ?? 0,
    }));
  }

  /**
   * Returns per-class attendance totals using DB-level COUNT aggregation.
   * Replaces the old full-row scan (N rows → 2 rows per class).
   */
  async findAttendanceStatsByClass(classIds: string[]): Promise<ClassAttendanceStat[]> {
    if (classIds.length === 0) return [];
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['classId', 'status'],
      where: { classId: { in: classIds } },
      _count: { status: true },
    });

    const map = new Map<string, { total: number; present: number }>();
    for (const row of grouped) {
      const entry = map.get(row.classId) ?? { total: 0, present: 0 };
      entry.total += row._count.status;
      if (row.status === 'PRESENT') entry.present += row._count.status;
      map.set(row.classId, entry);
    }

    return classIds.map((id) => ({
      classId: id,
      ...(map.get(id) ?? { total: 0, present: 0 }),
    }));
  }

  /**
   * Returns the N most recent test sessions across all teacher classes,
   * ordered newest-first.
   */
  async findRecentSessions(classIds: string[]): Promise<RawSession[]> {
    if (classIds.length === 0) return [];
    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds } },
      orderBy: { conductedAt: 'desc' },
      take: RECENT_SESSIONS_LIMIT,
      select: {
        id: true,
        classId: true,
        conductedAt: true,
        class: { select: { name: true } },
        testType: { select: { nameHe: true } },
      },
    });
    return sessions.map((s) => ({
      sessionId: s.id,
      classId: s.classId,
      className: s.class.name,
      testNameHe: s.testType.nameHe,
      conductedAt: s.conductedAt,
    }));
  }

  /**
   * Counts how many (session, student) pairs are missing a TestResult.
   * Only counts sessions that already exist — not hypothetical future sessions.
   */
  async findPendingResultsCount(classIds: string[]): Promise<number> {
    if (classIds.length === 0) return 0;
    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds } },
      select: {
        _count: { select: { results: true } },
        class: { select: { _count: { select: { enrollments: true } } } },
      },
    });
    return sessions.reduce((total, s) => {
      return total + Math.max(0, s.class._count.enrollments - s._count.results);
    }, 0);
  }

  /**
   * Returns every (student, session) pair where the student has no TestResult.
   * Uses two parallel queries to avoid loading all enrollments per-session
   * (which would duplicate enrollment rows N times — once per session in the class).
   */
  async findMissingResultDetails(classIds: string[]): Promise<MissingResultItem[]> {
    if (classIds.length === 0) return [];

    // Fetch sessions (with result student IDs) and all enrollments in parallel
    const [sessions, enrollments] = await Promise.all([
      this.prisma.testSession.findMany({
        where: { classId: { in: classIds } },
        orderBy: { conductedAt: 'desc' },
        select: {
          id: true,
          conductedAt: true,
          classId: true,
          testType: { select: { nameHe: true } },
          class: { select: { name: true } },
          results: { select: { studentId: true } },
        },
      }),
      this.prisma.classEnrollment.findMany({
        where: { classId: { in: classIds } },
        select: {
          classId: true,
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    // Build a classId → students lookup so we iterate enrollments once
    const studentsByClass = new Map<string, Array<{ id: string; firstName: string; lastName: string }>>();
    for (const e of enrollments) {
      const list = studentsByClass.get(e.classId) ?? [];
      list.push(e.student);
      studentsByClass.set(e.classId, list);
    }

    const items: MissingResultItem[] = [];
    for (const session of sessions) {
      const resultStudentIds = new Set(session.results.map((r: { studentId: string }) => r.studentId));
      const classStudents = studentsByClass.get(session.classId) ?? [];
      for (const student of classStudents) {
        if (!resultStudentIds.has(student.id)) {
          items.push({
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            classId: session.classId,
            className: session.class.name,
            sessionId: session.id,
            testNameHe: session.testType.nameHe,
            sessionDate: session.conductedAt,
          });
        }
      }
    }
    return items;
  }

  /**
   * Returns all individual test results that are below the norm threshold.
   * Used by the "below norm" drill-down endpoint.
   */
  async findBelowNormDetails(
    classIds: string[],
    threshold: number,
  ): Promise<BelowNormItem[]> {
    if (classIds.length === 0) return [];
    const results = await this.prisma.testResult.findMany({
      where: {
        session: { classId: { in: classIds } },
        calculatedGrade: { lt: threshold },
      },
      orderBy: { calculatedGrade: 'asc' },
      select: {
        calculatedGrade: true,
        student: { select: { id: true, firstName: true, lastName: true } },
        session: {
          select: {
            classId: true,
            class: { select: { name: true } },
            testType: { select: { nameHe: true } },
          },
        },
      },
    });

    return results.map((r) => ({
      studentId: r.student.id,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      classId: r.session.classId,
      className: r.session.class.name,
      testNameHe: r.session.testType.nameHe,
      score: r.calculatedGrade ?? 0,
      normThreshold: threshold,
    }));
  }

  /**
   * Returns the top N students by average calculatedGrade across all teacher classes.
   * Uses DB-level groupBy + _avg instead of loading all result rows into memory.
   * Students with no results are excluded.
   */
  async findTopStudents(classIds: string[], limit: number): Promise<RawTopStudent[]> {
    if (classIds.length === 0) return [];

    // Step 1: Resolve session IDs for the teacher's classes (avoids nested-relation groupBy limitation)
    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds } },
      select: { id: true, classId: true },
    });
    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);
    const sessionClassMap = new Map(sessions.map((s) => [s.id, s.classId]));

    // Step 2: Group by studentId with DB-level average — far cheaper than fetching all rows
    const grouped = await this.prisma.testResult.groupBy({
      by: ['studentId'],
      where: { sessionId: { in: sessionIds }, calculatedGrade: { not: null } },
      _avg: { calculatedGrade: true },
      _count: { id: true },
      orderBy: { _avg: { calculatedGrade: 'desc' } },
      take: limit,
    });
    if (grouped.length === 0) return [];

    // Step 3: Fetch names + class enrollment + gender for the top-N students only
    const topStudentIds = grouped.map((g) => g.studentId);
    const students = await this.prisma.student.findMany({
      where: { id: { in: topStudentIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        enrollments: {
          where: { classId: { in: classIds } },
          select: { classId: true, class: { select: { name: true } } },
          take: 1,
        },
      },
    });

    const studentInfoMap = new Map(students.map((s) => [s.id, s]));

    // Rebuild in sorted order (groupBy already sorted by desc avg)
    return grouped
      .map((g) => {
        const info = studentInfoMap.get(g.studentId);
        const enrollment = info?.enrollments[0];
        return {
          studentId: g.studentId,
          studentName: info ? `${info.firstName} ${info.lastName}` : '',
          classId: enrollment?.classId ?? sessionClassMap.get(sessions.find((s) => s.classId)?.id ?? '') ?? '',
          className: enrollment?.class.name ?? '',
          avgGrade: Math.round(g._avg.calculatedGrade ?? 0),
          resultCount: g._count.id,
          gender: info?.gender ?? 'OTHER',
        };
      })
      .filter((r) => r.studentName !== '');
  }

  /**
   * Returns top N students for a specific test type.
   * Groups by studentId → average grade across all results of that test type.
   */
  async findTopStudentsByTestType(
    classIds: string[],
    testTypeId: string,
    limit: number,
  ): Promise<RawTopStudent[]> {
    if (classIds.length === 0) return [];

    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds }, testTypeId },
      select: { id: true, classId: true },
    });
    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);
    const sessionClassMap = new Map(sessions.map((s) => [s.id, s.classId]));

    const grouped = await this.prisma.testResult.groupBy({
      by: ['studentId'],
      where: { sessionId: { in: sessionIds }, calculatedGrade: { not: null } },
      _avg: { calculatedGrade: true },
      _count: { id: true },
      orderBy: { _avg: { calculatedGrade: 'desc' } },
      take: limit,
    });
    if (grouped.length === 0) return [];

    const topStudentIds = grouped.map((g) => g.studentId);
    const students = await this.prisma.student.findMany({
      where: { id: { in: topStudentIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        enrollments: {
          where: { classId: { in: classIds } },
          select: { classId: true, class: { select: { name: true } } },
          take: 1,
        },
      },
    });

    const studentInfoMap = new Map(students.map((s) => [s.id, s]));

    return grouped
      .map((g) => {
        const info = studentInfoMap.get(g.studentId);
        const enrollment = info?.enrollments[0];
        return {
          studentId: g.studentId,
          studentName: info ? `${info.firstName} ${info.lastName}` : '',
          classId: enrollment?.classId ?? sessionClassMap.get(sessions.find((s) => s.classId)?.id ?? '') ?? '',
          className: enrollment?.class.name ?? '',
          avgGrade: Math.round(g._avg.calculatedGrade ?? 0),
          resultCount: g._count.id,
          gender: info?.gender ?? 'OTHER',
        };
      })
      .filter((r) => r.studentName !== '');
  }
}
