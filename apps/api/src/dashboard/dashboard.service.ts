import { Injectable } from '@nestjs/common';
import { DashboardRepository, PASS_GRADE_THRESHOLD } from './dashboard.repository';
import type { DashboardClassStatDto, DashboardStatsResponseDto, RecentSessionDto } from './dto/dashboard-stats-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getStats(teacherId: string): Promise<DashboardStatsResponseDto> {
    const classes = await this.dashboardRepository.findTeacherClassMeta(teacherId);
    const classIds = classes.map((c) => c.id);

    const [rawResults, rawAttendance, rawSessions] = await Promise.all([
      this.dashboardRepository.findResultsForTeacher(classIds),
      this.dashboardRepository.findAttendanceForTeacher(classIds),
      this.dashboardRepository.findRecentSessions(classIds),
    ]);

    // ── Overall fitness avg ──────────────────────────────────────────
    const overallFitnessAvg =
      rawResults.length > 0
        ? Math.round(rawResults.reduce((s, r) => s + r.calculatedGrade, 0) / rawResults.length)
        : 0;

    // ── Overall attendance % ─────────────────────────────────────────
    const overallAttendancePct =
      rawAttendance.length > 0
        ? Math.round((rawAttendance.filter((r) => r.isPresent).length / rawAttendance.length) * 100)
        : 0;

    // ── Per-class stats ──────────────────────────────────────────────
    const classStats: DashboardClassStatDto[] = classes.map((cls) => {
      const classResults = rawResults.filter((r) => r.sessionClassId === cls.id);
      const classAttendance = rawAttendance.filter((r) => r.classId === cls.id);

      const fitnessAvg =
        classResults.length > 0
          ? Math.round(classResults.reduce((s, r) => s + r.calculatedGrade, 0) / classResults.length)
          : 0;

      const attendancePct =
        classAttendance.length > 0
          ? Math.round((classAttendance.filter((r) => r.isPresent).length / classAttendance.length) * 100)
          : 0;

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

    // ── Pending results count ────────────────────────────────────────
    // Expected = sessions × enrollments per class; pending = expected - actual
    const pendingResultsCount = classes.reduce((total, cls) => {
      const expected = cls.sessionCount * cls.studentCount;
      const actual = rawResults.filter((r) => r.sessionClassId === cls.id).length;
      return total + Math.max(0, expected - actual);
    }, 0);

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
}
