import { Injectable } from '@nestjs/common';
import { DashboardRepository, PASS_GRADE_THRESHOLD, TOP_ACHIEVEMENTS_LIMIT, TOP_STUDENTS_LIMIT } from './dashboard.repository';
import type { ClassAttendanceStat } from './dashboard.repository';
import type {
  DashboardClassStatDto,
  DashboardStatsResponseDto,
  RecentSessionDto,
  MissingResultItemDto,
  BelowNormItemDto,
  TopStudentItemDto,
  TopAchievementItemDto,
  TopStudentPerClassItemDto,
} from './dto/dashboard-stats-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  private async getTeacherClassIds(teacherId: string): Promise<string[]> {
    const classes = await this.dashboardRepository.findTeacherClassMeta(teacherId);
    return classes.map((c) => c.id);
  }

  async getStats(teacherId: string): Promise<DashboardStatsResponseDto> {
    const classes = await this.dashboardRepository.findTeacherClassMeta(teacherId);
    const classIds = classes.map((c) => c.id);

    const [rawResults, attendanceStats, rawSessions, pendingResultsCount] =
      await Promise.all([
        this.dashboardRepository.findResultsForTeacher(classIds),
        this.dashboardRepository.findAttendanceStatsByClass(classIds),
        this.dashboardRepository.findRecentSessions(classIds),
        this.dashboardRepository.findPendingResultsCount(classIds),
      ]);

    const attendanceByClass = new Map<string, ClassAttendanceStat>(
      attendanceStats.map((a) => [a.classId, a]),
    );

    // ── Overall fitness avg ──────────────────────────────────────────
    const overallFitnessAvg =
      rawResults.length > 0
        ? Math.round(rawResults.reduce((s, r) => s + r.calculatedGrade, 0) / rawResults.length)
        : 0;

    // ── Overall attendance % (sum all class totals/presents) ─────────
    const totalPresent = attendanceStats.reduce((s, a) => s + a.present, 0);
    const totalRecords = attendanceStats.reduce((s, a) => s + a.total, 0);
    const overallAttendancePct =
      totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    // ── Per-class stats ──────────────────────────────────────────────
    const classStats: DashboardClassStatDto[] = classes.map((cls) => {
      const classResults = rawResults.filter((r) => r.sessionClassId === cls.id);
      const att = attendanceByClass.get(cls.id);

      const fitnessAvg =
        classResults.length > 0
          ? Math.round(classResults.reduce((s, r) => s + r.calculatedGrade, 0) / classResults.length)
          : 0;

      const attendancePct =
        att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;

      // A student is "below norm" if their average grade across all sessions < PASS threshold
      const studentGradeMap = new Map<string, number[]>();
      for (const r of classResults) {
        const grades = studentGradeMap.get(r.studentId) ?? [];
        grades.push(r.calculatedGrade);
        studentGradeMap.set(r.studentId, grades);
      }
      const belowNormCount = [...studentGradeMap.values()].filter(
        (grades) => grades.reduce((s, g) => s + g, 0) / grades.length < PASS_GRADE_THRESHOLD,
      ).length;

      return { classId: cls.id, fitnessAvg, attendancePct, belowNormCount };
    });

    // ── Totals ───────────────────────────────────────────────────────
    const totalBelowNormCount = classStats.reduce((s, c) => s + c.belowNormCount, 0);
    const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);

    // ── Recent sessions ──────────────────────────────────────────────
    const recentSessions: RecentSessionDto[] = rawSessions.map((s) => ({
      sessionId: s.sessionId,
      classId: s.classId,
      className: s.className,
      testNameHe: s.testNameHe,
      conductedAt: s.conductedAt.toISOString(),
    }));

    return {
      overallFitnessAvg,
      overallAttendancePct,
      totalBelowNormCount,
      totalStudents,
      pendingResultsCount,
      classStats,
      recentSessions,
    };
  }

  async getMissingResults(teacherId: string): Promise<MissingResultItemDto[]> {
    const classIds = await this.getTeacherClassIds(teacherId);
    const items = await this.dashboardRepository.findMissingResultDetails(classIds);
    return items.map((item) => ({
      studentId: item.studentId,
      studentName: item.studentName,
      classId: item.classId,
      className: item.className,
      sessionId: item.sessionId,
      testNameHe: item.testNameHe,
      sessionDate: item.sessionDate.toISOString(),
    }));
  }

  async getBelowNormDetails(teacherId: string): Promise<BelowNormItemDto[]> {
    const classIds = await this.getTeacherClassIds(teacherId);
    return this.dashboardRepository.findBelowNormDetails(classIds, PASS_GRADE_THRESHOLD);
  }

  async getTopStudents(teacherId: string, testTypeId?: string): Promise<TopStudentItemDto[]> {
    const classIds = await this.getTeacherClassIds(teacherId);
    const students = testTypeId
      ? await this.dashboardRepository.findTopStudentsByTestType(classIds, testTypeId, TOP_STUDENTS_LIMIT)
      : await this.dashboardRepository.findTopStudents(classIds, TOP_STUDENTS_LIMIT);
    return students.map((s, i) => ({ rank: i + 1, ...s }));
  }

  async getTopAchievements(teacherId: string): Promise<TopAchievementItemDto[]> {
    const classIds = await this.getTeacherClassIds(teacherId);
    const items = await this.dashboardRepository.findTopAchievements(classIds, TOP_ACHIEVEMENTS_LIMIT);
    return items.map((item, i) => ({ rank: i + 1, ...item }));
  }

  async getTopStudentsPerClass(teacherId: string): Promise<TopStudentPerClassItemDto[]> {
    const classIds = await this.getTeacherClassIds(teacherId);
    return this.dashboardRepository.findTopStudentsPerClass(classIds);
  }
}
