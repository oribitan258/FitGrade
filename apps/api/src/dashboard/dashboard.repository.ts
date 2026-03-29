import { Injectable } from '@nestjs/common';
import type { Semester } from '@prisma/client';
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

export interface RawTopStudentPerClass {
  rank: number;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  avgScore: number;
}

export interface RawTopAchievement {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  /** Gender composition of the class: BOYS | GIRLS | MIXED */
  classGenderType: string;
  examName: string;
  /** Unit label for the test type, e.g. "שניות", "מטר" — null for REPS/PASS_FAIL. */
  unit: string | null;
  /** Raw measurement value (seconds for TIME, reps for REPS, etc.) — null if not recorded. */
  rawValue: number | null;
  score: number;
}

/** Maximum students returned by the top-students endpoint. */
export const TOP_STUDENTS_LIMIT = 20;

/** Maximum achievements returned by the top-achievements endpoint. */
export const TOP_ACHIEVEMENTS_LIMIT = 10;

export interface MonthlyClassAverage {
  /** ISO month string "YYYY-MM" — used for sorting and as the chart X-axis key. */
  month: string;
  classId: string;
  className: string;
  /** Rounded average grade (0–100). */
  avg: number;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all class IDs for the teacher with enrollment counts.
   * Classes are year-round entities — no semester filter applied here.
   * Semester filtering is applied at the TestSession level in downstream queries.
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
   * Returns all test results for the teacher's classes, optionally scoped to a semester.
   * Used for in-memory aggregation of fitness stats.
   */
  async findResultsForTeacher(classIds: string[], semester?: Semester): Promise<RawResult[]> {
    if (classIds.length === 0) return [];
    const results = await this.prisma.testResult.findMany({
      where: {
        session: {
          classId: { in: classIds },
          ...(semester !== undefined ? { semester } : {}),
        },
      },
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
   * Scoped to the given semester so A and B show independent attendance stats.
   */
  async findAttendanceStatsByClass(classIds: string[], semester?: Semester): Promise<ClassAttendanceStat[]> {
    if (classIds.length === 0) return [];
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['classId', 'status'],
      where: {
        classId: { in: classIds },
        ...(semester !== undefined ? { semester } : {}),
      },
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
   * ordered newest-first. Optionally scoped to a semester.
   */
  async findRecentSessions(classIds: string[], semester?: Semester): Promise<RawSession[]> {
    if (classIds.length === 0) return [];
    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds }, ...(semester !== undefined ? { semester } : {}) },
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
   * Counts missing results using a (classId, testTypeId) grouping.
   *
   * A student is "missing" for a test type if they have NO result across ALL
   * sessions of that test type in that class — not once per session.
   * This prevents duplicate counts when a teacher runs the same test multiple
   * times for different sub-groups of students.
   */
  async findPendingResultsCount(classIds: string[], semester?: Semester): Promise<number> {
    if (classIds.length === 0) return 0;

    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds }, ...(semester !== undefined ? { semester } : {}) },
      select: {
        classId: true,
        testTypeId: true,
        results: { select: { studentId: true } },
        class: { select: { _count: { select: { enrollments: true } } } },
      },
    });

    // classId → testTypeId → Set of student IDs that have at least one result
    const byClass = new Map<string, Map<string, Set<string>>>();
    const enrollmentCount = new Map<string, number>();

    for (const session of sessions) {
      if (!byClass.has(session.classId)) byClass.set(session.classId, new Map());
      const byType = byClass.get(session.classId)!;
      if (!byType.has(session.testTypeId)) byType.set(session.testTypeId, new Set());
      const done = byType.get(session.testTypeId)!;
      for (const r of session.results) done.add(r.studentId);
      enrollmentCount.set(session.classId, session.class._count.enrollments);
    }

    let total = 0;
    for (const [classId, byType] of byClass) {
      const count = enrollmentCount.get(classId) ?? 0;
      for (const done of byType.values()) {
        total += Math.max(0, count - done.size);
      }
    }
    return total;
  }

  /**
   * Returns one missing-result item per (student, testType, class) combination.
   *
   * Groups sessions by (classId, testTypeId) so that a student who appears in
   * ANY session of the same test type is not counted as missing — regardless of
   * how many times the teacher opened that test mode for other students.
   * The most recent session's ID and date are used as the representative reference.
   */
  async findMissingResultDetails(classIds: string[], semester?: Semester): Promise<MissingResultItem[]> {
    if (classIds.length === 0) return [];

    const [sessions, enrollments] = await Promise.all([
      this.prisma.testSession.findMany({
        where: { classId: { in: classIds }, ...(semester !== undefined ? { semester } : {}) },
        orderBy: { conductedAt: 'desc' }, // newest first — first encounter per combo = most recent
        select: {
          id: true,
          conductedAt: true,
          classId: true,
          testTypeId: true,
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

    // classId → student list
    const studentsByClass = new Map<string, Array<{ id: string; firstName: string; lastName: string }>>();
    for (const e of enrollments) {
      const list = studentsByClass.get(e.classId) ?? [];
      list.push(e.student);
      studentsByClass.set(e.classId, list);
    }

    // classId → testTypeId → combo metadata
    // First encounter (newest session) sets the representative sessionId/date.
    interface ComboMeta {
      sessionId: string;
      className: string;
      testNameHe: string;
      sessionDate: Date;
      done: Set<string>; // student IDs with at least one result in this combo
    }
    const combos = new Map<string, Map<string, ComboMeta>>();

    for (const session of sessions) {
      if (!combos.has(session.classId)) combos.set(session.classId, new Map());
      const byType = combos.get(session.classId)!;
      if (!byType.has(session.testTypeId)) {
        byType.set(session.testTypeId, {
          sessionId: session.id,
          className: session.class.name,
          testNameHe: session.testType.nameHe,
          sessionDate: session.conductedAt,
          done: new Set(),
        });
      }
      const meta = byType.get(session.testTypeId)!;
      for (const r of session.results) meta.done.add(r.studentId);
    }

    const items: MissingResultItem[] = [];
    for (const [classId, byType] of combos) {
      const classStudents = studentsByClass.get(classId) ?? [];
      for (const meta of byType.values()) {
        for (const student of classStudents) {
          if (!meta.done.has(student.id)) {
            items.push({
              studentId: student.id,
              studentName: `${student.firstName} ${student.lastName}`,
              classId,
              className: meta.className,
              sessionId: meta.sessionId,
              testNameHe: meta.testNameHe,
              sessionDate: meta.sessionDate,
            });
          }
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
    semester?: Semester,
  ): Promise<BelowNormItem[]> {
    if (classIds.length === 0) return [];
    const results = await this.prisma.testResult.findMany({
      where: {
        session: {
          classId: { in: classIds },
          ...(semester !== undefined ? { semester } : {}),
        },
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
  async findTopStudents(classIds: string[], limit: number, semester?: Semester): Promise<RawTopStudent[]> {
    if (classIds.length === 0) return [];

    // Step 1: Resolve session IDs for the teacher's classes (avoids nested-relation groupBy limitation)
    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds }, ...(semester !== undefined ? { semester } : {}) },
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
    semester?: Semester,
  ): Promise<RawTopStudent[]> {
    if (classIds.length === 0) return [];

    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds }, testTypeId, ...(semester !== undefined ? { semester } : {}) },
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

  /**
   * Returns the top N individual test results across all teacher classes,
   * deduplicated by student (only the student's single best result is kept),
   * ordered by score descending.
   */
  async findTopAchievements(classIds: string[], limit: number, semester?: Semester): Promise<RawTopAchievement[]> {
    if (classIds.length === 0) return [];

    // Fetch a wide set ordered by score desc; deduplicate in memory to ensure
    // each student appears at most once with their highest-scoring result.
    const results = await this.prisma.testResult.findMany({
      where: {
        session: {
          classId: { in: classIds },
          ...(semester !== undefined ? { semester } : {}),
        },
        calculatedGrade: { not: null },
      },
      orderBy: { calculatedGrade: 'desc' },
      take: limit * 10,
      select: {
        calculatedGrade: true,
        rawValue: true,
        student: { select: { id: true, firstName: true, lastName: true } },
        session: {
          select: {
            classId: true,
            class: { select: { name: true, genderType: true } },
            testType: { select: { nameHe: true, unit: true } },
          },
        },
      },
    });

    const seen = new Set<string>();
    const deduped: RawTopAchievement[] = [];
    for (const r of results) {
      if (seen.has(r.student.id)) continue;
      seen.add(r.student.id);
      deduped.push({
        studentId: r.student.id,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        classId: r.session.classId,
        className: r.session.class.name,
        classGenderType: r.session.class.genderType,
        examName: r.session.testType.nameHe,
        unit: r.session.testType.unit,
        rawValue: r.rawValue !== null ? Number(r.rawValue) : null,
        score: r.calculatedGrade ?? 0,
      });
      if (deduped.length === limit) break;
    }
    return deduped;
  }

  /**
   * Returns the top 3 students per class by average calculatedGrade.
   * Aggregates in memory: sessions → results → group by classId+studentId → avg → top-3 per class.
   */
  async findTopStudentsPerClass(classIds: string[], semester?: Semester): Promise<RawTopStudentPerClass[]> {
    if (classIds.length === 0) return [];

    // Step 1: sessions with classId for the teachers' classes
    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds }, ...(semester !== undefined ? { semester } : {}) },
      select: { id: true, classId: true },
    });
    if (sessions.length === 0) return [];

    const sessionClassMap = new Map(sessions.map((s) => [s.id, s.classId]));

    // Step 2: all results for those sessions
    const results = await this.prisma.testResult.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) }, calculatedGrade: { not: null } },
      select: { studentId: true, sessionId: true, calculatedGrade: true },
    });

    // Step 3: group by classId → studentId → grades[]
    const classStudentGrades = new Map<string, Map<string, number[]>>();
    for (const r of results) {
      const classId = sessionClassMap.get(r.sessionId);
      if (!classId) continue;
      if (!classStudentGrades.has(classId)) classStudentGrades.set(classId, new Map());
      const studentMap = classStudentGrades.get(classId)!;
      const grades = studentMap.get(r.studentId) ?? [];
      grades.push(r.calculatedGrade ?? 0);
      studentMap.set(r.studentId, grades);
    }

    // Step 4: per class → sort by avg → take top 3
    const topEntries: Array<{ classId: string; studentId: string; avgScore: number }> = [];
    for (const [classId, studentMap] of classStudentGrades) {
      const sorted = [...studentMap.entries()]
        .map(([studentId, grades]) => ({
          studentId,
          avgScore: Math.round(grades.reduce((s, g) => s + g, 0) / grades.length),
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 3);
      for (const s of sorted) topEntries.push({ classId, ...s });
    }
    if (topEntries.length === 0) return [];

    // Step 5: fetch student names and class names in parallel
    const studentIds = [...new Set(topEntries.map((x) => x.studentId))];
    const [students, classes] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true },
      }),
    ]);

    const studentNameMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
    const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

    // Step 6: build flat ranked list — rank resets per class
    const byClass = new Map<string, Array<{ studentId: string; avgScore: number }>>();
    for (const entry of topEntries) {
      const list = byClass.get(entry.classId) ?? [];
      list.push({ studentId: entry.studentId, avgScore: entry.avgScore });
      byClass.set(entry.classId, list);
    }

    const output: RawTopStudentPerClass[] = [];
    for (const [classId, students] of byClass) {
      students.forEach((s, idx) => {
        const studentName = studentNameMap.get(s.studentId);
        if (!studentName) return;
        output.push({
          rank: idx + 1,
          studentId: s.studentId,
          studentName,
          classId,
          className: classNameMap.get(classId) ?? '',
          avgScore: s.avgScore,
        });
      });
    }
    return output;
  }

  /**
   * Returns average test grades grouped by class and calendar month for charting.
   * Aggregates coalesce(gradeOverride, calculatedGrade) per (classId, YYYY-MM month).
   * Results are sorted by month ascending so chart lines render left-to-right.
   * Uses in-memory grouping to stay within the no-raw-SQL rule.
   */
  async findMonthlyClassAverages(
    classIds: string[],
    semester?: Semester,
  ): Promise<MonthlyClassAverage[]> {
    if (classIds.length === 0) return [];

    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds }, ...(semester !== undefined ? { semester } : {}) },
      select: {
        id: true,
        classId: true,
        conductedAt: true,
        class: { select: { name: true } },
      },
    });
    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);

    const results = await this.prisma.testResult.findMany({
      where: {
        sessionId: { in: sessionIds },
        calculatedGrade: { not: null },
      },
      select: { sessionId: true, calculatedGrade: true, gradeOverride: true },
    });
    if (results.length === 0) return [];

    // Build a lookup: sessionId → { classId, className, month "YYYY-MM" }
    const sessionMeta = new Map(
      sessions.map((s) => [
        s.id,
        {
          classId: s.classId,
          className: s.class.name,
          month: s.conductedAt.toISOString().slice(0, 7), // "YYYY-MM"
        },
      ]),
    );

    // Accumulate grades: "YYYY-MM|classId" → { className, grades[] }
    const buckets = new Map<string, { className: string; grades: number[] }>();
    for (const r of results) {
      const meta = sessionMeta.get(r.sessionId);
      if (!meta) continue;
      const key = `${meta.month}|${meta.classId}`;
      const bucket = buckets.get(key) ?? { className: meta.className, grades: [] };
      bucket.grades.push(r.gradeOverride ?? r.calculatedGrade ?? 0);
      buckets.set(key, bucket);
    }

    const output: MonthlyClassAverage[] = [];
    for (const [key, bucket] of buckets) {
      const [month, classId] = key.split('|') as [string, string];
      const avg = Math.round(bucket.grades.reduce((s, g) => s + g, 0) / bucket.grades.length);
      output.push({ month, classId, className: bucket.className, avg });
    }

    return output.sort((a, b) => a.month.localeCompare(b.month));
  }
}
