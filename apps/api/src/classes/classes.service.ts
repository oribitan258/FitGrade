import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { AuditAction, type Semester } from '@prisma/client';
import { ClassesRepository } from './classes.repository';
import type { CreateClassDto } from './dto/create-class.dto';
import type { ClassResponseDto } from './dto/class-response.dto';
import type {
  ClassDetailsResponseDto,
  GradeDistributionDto,
  ProgressPointDto,
  StudentGradeDto,
  TestSummaryDto,
} from './dto/class-details-response.dto';
import type { UpdateClassWeightsDto } from './dto/update-class-weights.dto';
import type { QuickGradeOverrideDto } from './dto/quick-grade-override.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

/** Hebrew month labels for the progress chart X-axis. */
const HEBREW_MONTH_LABELS: Record<number, string> = {
  1: "ינו'",  2: "פבר'",  3: "מרץ",   4: "אפר'",
  5: "מאי",   6: "יוני",  7: "יולי",  8: "אוג'",
  9: "ספט'",  10: "אוק'", 11: "נוב'", 12: "דצמ'",
};

/**
 * Grade thresholds for the distribution chart.
 * Must match the constants in packages/types/src/grade-labels.ts exactly.
 * GRADE_PASS = 55: grades 55–59 are "עובר" (pass), not "fail".
 */
const GRADE_EXCELLENT = 90;
const GRADE_GOOD      = 75;
const GRADE_PASS      = 55;

/** 6-digit numeric join code range — supports numeric keyboard on mobile, no ambiguous chars. */
const JOIN_CODE_MIN = 100_000;
const JOIN_CODE_MAX = 999_999;
/** Days before a new join code expires. */
const JOIN_CODE_TTL_DAYS = 7;
/** Maximum attempts before giving up on join code generation (collision guard). */
const JOIN_CODE_MAX_ATTEMPTS = 3;

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    private readonly classesRepository: ClassesRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Returns all classes for the authenticated teacher (year-round, no semester filter).
   */
  async getMyClasses(teacherId: string): Promise<ClassResponseDto[]> {
    return this.classesRepository.findAllByTeacher(teacherId);
  }

  /**
   * Returns a single class.
   * Throws NotFoundException if the class doesn't exist or belongs to another teacher.
   */
  async getClassById(
    classId: string,
    teacherId: string,
  ): Promise<ClassResponseDto> {
    return this.classesRepository.findOneByIdAndTeacher(classId, teacherId);
  }

  /**
   * Returns aggregated class details for the class detail page.
   * Includes per-test summaries (progress, distribution, per-student grades)
   * and the overall attendance percentage.
   * When `semester` is provided, only test results from that semester are included.
   * Throws NotFoundException if classId doesn't belong to teacherId.
   */
  async getClassDetails(
    classId: string,
    teacherId: string,
    semester?: Semester,
  ): Promise<ClassDetailsResponseDto> {
    // Ownership check — throws NotFoundException if class not found or wrong teacher
    await this.classesRepository.findOneByIdAndTeacher(classId, teacherId);

    const { results, attendanceTotal, attendancePresent } =
      await this.classesRepository.findRawClassDetails(classId, semester);

    const attendancePct =
      attendanceTotal > 0
        ? Math.round((attendancePresent / attendanceTotal) * 100)
        : 0;

    // ── Aggregate results per test type ────────────────────────────────────────
    interface TestAccumulator {
      nameHe: string;
      unit: string | null;
      // key: conductedAt ISO string → accumulated grades for that session
      sessions: Map<string, { conductedAt: Date; grades: number[] }>;
      // key: studentId → { sum, count }
      studentTotals: Map<string, { sum: number; count: number }>;
      // key: studentId → rawValue from the most recent session (overwritten as results are asc-sorted)
      studentLatestRaw: Map<string, number | null>;
      // key: studentId → gradeOverride from the most recent session (overwritten as results are asc-sorted)
      studentLatestGradeOverride: Map<string, number | null>;
    }

    const testMap = new Map<string, TestAccumulator>();

    for (const result of results) {
      const { testTypeId, conductedAt, testType } = result.session;
      const effectiveGrade = result.gradeOverride ?? result.calculatedGrade ?? 0;

      if (!testMap.has(testTypeId)) {
        testMap.set(testTypeId, {
          nameHe: testType.nameHe,
          unit: testType.unit,
          sessions: new Map(),
          studentTotals: new Map(),
          studentLatestRaw: new Map(),
          studentLatestGradeOverride: new Map(),
        });
      }

      const acc = testMap.get(testTypeId)!;

      // Sessions keyed by ISO timestamp string for deduplication
      const sessionKey = conductedAt.toISOString();
      const sessionData = acc.sessions.get(sessionKey) ?? { conductedAt, grades: [] };
      sessionData.grades.push(effectiveGrade);
      acc.sessions.set(sessionKey, sessionData);

      const studentData = acc.studentTotals.get(result.studentId) ?? { sum: 0, count: 0 };
      studentData.sum += effectiveGrade;
      studentData.count++;
      acc.studentTotals.set(result.studentId, studentData);

      // Results are ordered asc by conductedAt, so the last write wins = most recent values
      acc.studentLatestRaw.set(
        result.studentId,
        result.rawValue !== null ? result.rawValue.toNumber() : null,
      );
      acc.studentLatestGradeOverride.set(result.studentId, result.gradeOverride);
    }

    // ── Build TestSummaryDto[] ──────────────────────────────────────────────────
    const testSummaries: TestSummaryDto[] = [...testMap.entries()].map(
      ([testTypeId, acc]) => {
        const progressData: ProgressPointDto[] = [...acc.sessions.values()]
          .sort((a, b) => a.conductedAt.getTime() - b.conductedAt.getTime())
          .map(({ conductedAt, grades }) => ({
            month: HEBREW_MONTH_LABELS[conductedAt.getMonth() + 1] ?? '',
            classAvg:
              grades.length > 0
                ? Math.round(grades.reduce((s, g) => s + g, 0) / grades.length)
                : 0,
          }));

        const studentGrades: StudentGradeDto[] = [
          ...acc.studentTotals.entries(),
        ].map(([studentId, { sum, count }]) => ({
          studentId,
          effectiveGrade: count > 0 ? Math.round(sum / count) : 0,
          rawValue: acc.studentLatestRaw.get(studentId) ?? null,
          // undefined → null fallback: student may not appear in the override map if they have no result
          gradeOverride: acc.studentLatestGradeOverride.get(studentId) ?? null,
        }));

        const distribution: GradeDistributionDto = { excellent: 0, good: 0, pass: 0, fail: 0 };
        for (const { effectiveGrade } of studentGrades) {
          if (effectiveGrade >= GRADE_EXCELLENT)      distribution.excellent++;
          else if (effectiveGrade >= GRADE_GOOD)      distribution.good++;
          else if (effectiveGrade >= GRADE_PASS)      distribution.pass++;
          else                                        distribution.fail++;
        }

        return { testTypeId, nameHe: acc.nameHe, unit: acc.unit, progressData, distribution, studentGrades };
      },
    );

    return { attendancePct, testSummaries };
  }

  /**
   * Updates the per-class grading weight overrides.
   * Pass null for both fields to reset to the teacher's global defaults.
   * When both are non-null they must sum to 100.
   */
  async updateClassWeights(
    classId: string,
    teacherId: string,
    dto: UpdateClassWeightsDto,
  ): Promise<ClassResponseDto> {
    const { testWeight, talmidautWeight } = dto;
    const onlyOneIsNull =
      (testWeight === null) !== (talmidautWeight === null);
    if (onlyOneIsNull) {
      throw new BadRequestException(
        'יש לאפס את שני המשקלים יחד, או לספק ערך לשניהם',
      );
    }
    if (testWeight !== null && talmidautWeight !== null) {
      if (Math.abs((testWeight + talmidautWeight) - 100) > 0.5) {
        throw new BadRequestException('משקל הכושר ומשקל התלמידות חייבים לסכום ל-100');
      }
    }
    const updated = await this.classesRepository.updateWeights(classId, teacherId, testWeight, talmidautWeight);
    this.logger.log(
      `Teacher ${teacherId} updated class ${classId} weights: test=${testWeight ?? 'global'} talmidaut=${talmidautWeight ?? 'global'}`,
    );
    return updated;
  }

  /**
   * Overrides the grade for the most recent test result for a student in a class.
   * The teacher must own the class. Throws NotFoundException if no result exists.
   */
  async setStudentGradeOverride(
    classId: string,
    studentId: string,
    dto: QuickGradeOverrideDto,
    teacherId: string,
  ): Promise<{ effectiveGrade: number }> {
    await this.classesRepository.findOneByIdAndTeacher(classId, teacherId);
    const result = await this.classesRepository.quickGradeOverride(
      classId,
      studentId,
      dto.testTypeId,
      dto.gradeOverride,
    );
    void this.auditLogService.log({
      action: AuditAction.GRADE_OVERRIDE,
      entityType: 'TestResult',
      entityId: `${classId}/${studentId}`,
      actorId: teacherId,
      newValue: { gradeOverride: dto.gradeOverride, testTypeId: dto.testTypeId },
    });
    return result;
  }

  /**
   * Creates a class with a freshly generated join code.
   *
   * Retries up to JOIN_CODE_MAX_ATTEMPTS times if the generated code collides
   * with an existing one (extremely unlikely at typical school scale).
   */
  async createClass(
    dto: CreateClassDto,
    teacherId: string,
  ): Promise<ClassResponseDto> {
    const genderType = (dto.genderType ?? 'MIXED') as 'BOYS' | 'GIRLS' | 'MIXED';
    const isDuplicate = await this.classesRepository.existsByNameAndGender(
      dto.name,
      genderType,
      teacherId,
    );
    if (isDuplicate) {
      throw new ConflictException('קיימת כבר כיתה בשם זה. נסה שם אחר');
    }

    const joinCodeExpiresAt = this.buildJoinCodeExpiry();

    for (let attempt = 1; attempt <= JOIN_CODE_MAX_ATTEMPTS; attempt++) {
      const joinCode = this.generateJoinCode();
      try {
        const created = await this.classesRepository.create({
          ...dto,
          // genderType defaults to MIXED when not provided by the teacher.
          // Uses string literal so this file compiles before `prisma generate` is run.
          genderType,
          teacherId,
          joinCode,
          joinCodeExpiresAt,
        });
        this.logger.log(
          `Class created: id=${created.id} teacher=${teacherId} code=${joinCode}`,
        );
        return created;
      } catch (e) {
        if (e instanceof ConflictException && attempt < JOIN_CODE_MAX_ATTEMPTS) {
          this.logger.warn(
            `Join code collision on attempt ${attempt}, retrying...`,
          );
          continue;
        }
        throw e;
      }
    }

    // Unreachable — loop always throws or returns, but TypeScript needs this
    throw new ConflictException('שגיאה ביצירת קוד הצטרפות — נסה שוב מאוחר יותר');
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private generateJoinCode(): string {
    return String(Math.floor(Math.random() * (JOIN_CODE_MAX - JOIN_CODE_MIN + 1)) + JOIN_CODE_MIN);
  }

  private buildJoinCodeExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + JOIN_CODE_TTL_DAYS);
    return expiry;
  }
}
