import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, Semester } from '@prisma/client';
import { ReportsRepository } from './reports.repository';
import type { ReportRowDto, TestBreakdownDto } from './dto/report-row.dto';
import type { GradeOverrideDto } from './dto/save-report-grades.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

// ─── Ministry of Education verbal comments bank ─────────────────────────────

/** All valid predefined verbal comments from the Ministry of Education. */
export const MINISTRY_COMMENTS_BANK: string[] = [
  // Attendance issues
  'הינך מרבה להעדר',
  'נוכחותך השנה הייתה חלקית וגרמה לפגיעה בלמידה',
  // Endurance / long-distance running
  'הישגיך בתחום הריצות הארוכות ראויים לציון',
  'עליך לשפר את יכולתך בריצות הסיבולת',
  // Strength
  'הישגיך בתחום כוח הידיים ראויים לציון',
  'עליך לשפר את יכולתך בכוח ידיים',
  // Speed
  'הישגיך בתחום הריצות הקצרות ראויים לציון',
  'עליך לשפר את יכולתך בריצות המהירות',
  // Flexibility
  'הישגיך בתחום הגמישות ראויים לציון',
  'עליך לשפר את יכולתך בגמישות',
  // General excellence
  'מראה התייחסות רצינית ומוטיבציה גבוהה',
  'שיפור ניכר לאורך השנה – כל הכבוד',
  'תפקודך בשיעורי החינוך הגופני ראוי לשבח',
  'מפגין/ה מצוינות וסיוע לחבריך – כל הכבוד',
  // Conduct / attitude
  'נדרשת לשיפור בהתנהגות בשיעורי חינוך גופני',
  'אינך מציג/ה מאמץ מספק בשיעורים',
  'ציוד הספורט אינו עומד בדרישות',
  // Average / encourage improvement
  'תוצאותיך ממוצעות – ניתן ורצוי לשפר',
  'ממשיך/ה להתפתח ומגלה שיפור מתמיד',
  'פוטנציאל גבוה — נדרשת עוד עבודה להוציאו אל הפועל',
];

// ─── Constants ───────────────────────────────────────────────────────────────

/** Penalty subtracted from conductScore per unexcused absence. */
const ABSENCE_PENALTY_PER_DAY = 5;

// ─── Heuristic function ───────────────────────────────────────────────────────

/**
 * Selects the most contextually appropriate Ministry comment for a student.
 * Priority: absence issues → specific weak tests → specific strong tests → overall grade.
 */
function suggestComment(params: {
  unexcusedAbsences: number;
  fitnessAvg: number;
  conductScore: number;
  talmidautAvg: number;
  testBreakdown: TestBreakdownDto[];
}): string {
  const { unexcusedAbsences, fitnessAvg, conductScore, talmidautAvg, testBreakdown } = params;

  // 1. Absence issues (highest priority)
  if (unexcusedAbsences >= 6) return 'הינך מרבה להעדר';
  if (unexcusedAbsences >= 3) return 'נוכחותך השנה הייתה חלקית וגרמה לפגיעה בלמידה';

  // 2. Conduct / talmidaut below threshold
  if (talmidautAvg > 0 && conductScore < 55) return 'נדרשת לשיפור בהתנהגות בשיעורי חינוך גופני';

  // 3. Per-test specific comments
  const endurance = testBreakdown.find(
    (t) => t.nameHe.includes('ריצה') || t.nameHe.includes('קופר') || t.nameHe.includes('סיבולת'),
  );
  const strength = testBreakdown.find(
    (t) => t.nameHe.includes('כוח') || t.nameHe.includes('עלייה') || t.nameHe.includes('שכיבה'),
  );
  const speed = testBreakdown.find(
    (t) => t.nameHe.includes('30') || t.nameHe.includes('50') || t.nameHe.includes('מהיר'),
  );
  const flexibility = testBreakdown.find(
    (t) => t.nameHe.includes('גמישות') || t.nameHe.includes('כפיפה'),
  );

  if (endurance && endurance.grade < 60) return 'עליך לשפר את יכולתך בריצות הסיבולת';
  if (strength && strength.grade < 60) return 'עליך לשפר את יכולתך בכוח ידיים';
  if (speed && speed.grade < 60) return 'עליך לשפר את יכולתך בריצות המהירות';
  if (flexibility && flexibility.grade < 60) return 'עליך לשפר את יכולתך בגמישות';

  if (endurance && endurance.grade >= 85) return 'הישגיך בתחום הריצות הארוכות ראויים לציון';
  if (strength && strength.grade >= 85) return 'הישגיך בתחום כוח הידיים ראויים לציון';
  if (speed && speed.grade >= 85) return 'הישגיך בתחום הריצות הקצרות ראויים לציון';
  if (flexibility && flexibility.grade >= 85) return 'הישגיך בתחום הגמישות ראויים לציון';

  // 4. Overall grade-based comments
  if (fitnessAvg >= 90) return 'מראה התייחסות רצינית ומוטיבציה גבוהה';
  if (fitnessAvg >= 85) return 'תפקודך בשיעורי החינוך הגופני ראוי לשבח';
  if (fitnessAvg >= 75) return 'שיפור ניכר לאורך השנה – כל הכבוד';
  if (fitnessAvg < 55) return 'תוצאותיך ממוצעות – ניתן ורצוי לשפר';

  return 'ממשיך/ה להתפתח ומגלה שיפור מתמיד';
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Returns the full class report: one row per student with computed grades,
   * conduct scores, recommended final grade, suggested comment, and any
   * teacher overrides that have been saved.
   *
   * When `semester` is provided, test results and attendance are scoped to
   * that semester only. Talmidaut records are always year-wide (no semester column).
   */
  async getClassReport(classId: string, teacherId: string, semester?: Semester): Promise<ReportRowDto[]> {
    const [cls, teacherDefaults] = await Promise.all([
      this.reportsRepository.verifyClassOwnership(classId, teacherId),
      this.reportsRepository.findTeacherGradingDefaults(teacherId),
    ]);

    // Resolve effective weights: class override → teacher global default
    const fitnessWeightPct =
      (cls.testWeight ?? teacherDefaults.defaultFitnessWeight) / 100;
    const conductWeightPct =
      (cls.talmidautWeight ?? teacherDefaults.defaultConductWeight) / 100;

    // IMPORTANT: Do NOT short-circuit on zero sessions.
    // The report is the single source of truth for the class roster.
    // Every enrolled student must appear as a row even if they have no grades
    // for the requested semester (fitnessAvg defaults to 0, testBreakdown to []).
    // The previous guard here returned [] when sessionCount === 0, which caused
    // the front-end to render "no students" for classes that simply hadn't
    // recorded any tests yet this semester.

    const students = await this.reportsRepository.findStudentsInClass(classId);
    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);

    const [testResults, talmidautSummaries, attendanceStats, finalGradeOverrides] =
      await Promise.all([
        this.reportsRepository.findAllTestResults(classId, studentIds, semester),
        this.reportsRepository.findAllTalmidautSummaries(classId, studentIds),
        this.reportsRepository.findAttendanceStats(classId, studentIds, semester),
        this.reportsRepository.findFinalGradeOverrides(classId, studentIds),
      ]);

    // Build lookup maps for O(1) access per student
    const talmidautByStudent = new Map(talmidautSummaries.map((t) => [t.studentId, t.compositeScores]));
    const overrideByStudent = new Map(finalGradeOverrides.map((o) => [o.studentId, o]));

    // Build attendance map: studentId → { absent: n, total: n }
    // EXCUSED lessons are excluded from total to match individual student report logic.
    const attendanceMap = new Map<string, { absent: number; total: number }>();
    for (const row of attendanceStats) {
      if (row.status === 'EXCUSED') continue;
      const entry = attendanceMap.get(row.studentId) ?? { absent: 0, total: 0 };
      entry.total += row.count;
      if (row.status === 'ABSENT') entry.absent += row.count;
      attendanceMap.set(row.studentId, entry);
    }

    // Group test results by studentId
    const resultsByStudent = new Map<string, typeof testResults>();
    for (const result of testResults) {
      const arr = resultsByStudent.get(result.studentId) ?? [];
      arr.push(result);
      resultsByStudent.set(result.studentId, arr);
    }

    return students.map((student): ReportRowDto => {
      const studentResults = resultsByStudent.get(student.id) ?? [];
      const talmidautScores = talmidautByStudent.get(student.id) ?? [];
      const attendance = attendanceMap.get(student.id) ?? { absent: 0, total: 0 };
      const override = overrideByStudent.get(student.id);

      // fitnessAvg: average of best effective grade per test type
      const gradesByTestType = new Map<string, number[]>();
      for (const r of studentResults) {
        const arr = gradesByTestType.get(r.testTypeId) ?? [];
        arr.push(r.effectiveGrade);
        gradesByTestType.set(r.testTypeId, arr);
      }
      const perTestBest = Array.from(gradesByTestType.values()).map((grades) =>
        Math.max(...grades),
      );
      const fitnessAvg =
        perTestBest.length > 0
          ? Math.round(perTestBest.reduce((s, g) => s + g, 0) / perTestBest.length)
          : 0;

      // talmidautAvg: average of all composite scores
      const talmidautAvg =
        talmidautScores.length > 0
          ? Math.round(talmidautScores.reduce((s, c) => s + c, 0) / talmidautScores.length)
          : 0;

      // conductScore = talmidautAvg − (unexcusedAbsences × penalty), clamped to [0, 100]
      const conductScore = Math.max(
        0,
        Math.min(100, talmidautAvg - attendance.absent * ABSENCE_PENALTY_PER_DAY),
      );

      const recommendedFinalGrade = Math.round(
        fitnessAvg * fitnessWeightPct + conductScore * conductWeightPct,
      );

      // Per-test breakdown: best grade per test type, sorted descending
      const testBreakdown: TestBreakdownDto[] = Array.from(gradesByTestType.entries())
        .map(([testTypeId, grades]) => {
          const result = studentResults.find((r) => r.testTypeId === testTypeId);
          return {
            testTypeId,
            nameHe: result?.testNameHe ?? '',
            grade: Math.max(...grades),
          };
        })
        .sort((a, b) => b.grade - a.grade);

      const suggestedComment = suggestComment({
        unexcusedAbsences: attendance.absent,
        fitnessAvg,
        conductScore,
        talmidautAvg,
        testBreakdown,
      });

      return {
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentCode: student.studentCode,
        fitnessAvg,
        conductScore,
        fitnessWeight: Math.round(fitnessWeightPct * 100),
        conductWeight: Math.round(conductWeightPct * 100),
        recommendedFinalGrade,
        teacherFinalGrade: override?.teacherFinalGrade ?? null,
        suggestedComment,
        verbalComment: override?.verbalComment ?? null,
        unexcusedAbsences: attendance.absent,
        totalLessons: attendance.total,
        testBreakdown,
      };
    });
  }

  /**
   * Persists teacher grade and comment overrides.
   */
  async saveGradeOverrides(
    classId: string,
    teacherId: string,
    overrides: GradeOverrideDto[],
  ): Promise<void> {
    await this.reportsRepository.verifyClassOwnership(classId, teacherId);
    if (overrides.length === 0) return;

    await this.reportsRepository.saveGradeOverrides(classId, overrides);
    this.logger.log(
      `Teacher ${teacherId} saved ${overrides.length} grade override(s) for class ${classId}`,
    );
    for (const override of overrides) {
      void this.auditLogService.log({
        action: AuditAction.GRADE_OVERRIDE,
        entityType: 'StudentFinalGrade',
        entityId: `${classId}/${override.studentId}`,
        actorId: teacherId,
        newValue: {
          teacherFinalGrade: override.teacherFinalGrade ?? null,
          verbalComment: override.verbalComment ?? null,
        },
      });
    }
  }

  /** Returns the Ministry comments bank (sent to frontend for the Combobox list). */
  getCommentsBank(): string[] {
    return MINISTRY_COMMENTS_BANK;
  }
}
