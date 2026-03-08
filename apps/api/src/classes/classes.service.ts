import { ConflictException, Injectable, Logger } from '@nestjs/common';
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

/** Hebrew month labels for the progress chart X-axis. */
const HEBREW_MONTH_LABELS: Record<number, string> = {
  1: "ינו'",  2: "פבר'",  3: "מרץ",   4: "אפר'",
  5: "מאי",   6: "יוני",  7: "יולי",  8: "אוג'",
  9: "ספט'",  10: "אוק'", 11: "נוב'", 12: "דצמ'",
};

/** Grade thresholds matching the frontend gradeLevel() function. */
const GRADE_EXCELLENT = 90;
const GRADE_GOOD      = 75;
const GRADE_PASS      = 60;

/** Alphanumeric chars with visually ambiguous characters removed (0/O, 1/I). */
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;
/** Days before a new join code expires. */
const JOIN_CODE_TTL_DAYS = 7;
/** Maximum attempts before giving up on join code generation (collision guard). */
const JOIN_CODE_MAX_ATTEMPTS = 3;

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(private readonly classesRepository: ClassesRepository) {}

  /** Returns all classes for the authenticated teacher. */
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
   * Throws NotFoundException if classId doesn't belong to teacherId.
   */
  async getClassDetails(
    classId: string,
    teacherId: string,
  ): Promise<ClassDetailsResponseDto> {
    // Ownership check — throws NotFoundException if class not found or wrong teacher
    await this.classesRepository.findOneByIdAndTeacher(classId, teacherId);

    const { results, attendanceTotal, attendancePresent } =
      await this.classesRepository.findRawClassDetails(classId);

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
   * Creates a class with a freshly generated join code.
   *
   * Retries up to JOIN_CODE_MAX_ATTEMPTS times if the generated code collides
   * with an existing one (extremely unlikely at typical school scale).
   */
  async createClass(
    dto: CreateClassDto,
    teacherId: string,
  ): Promise<ClassResponseDto> {
    const joinCodeExpiresAt = this.buildJoinCodeExpiry();

    for (let attempt = 1; attempt <= JOIN_CODE_MAX_ATTEMPTS; attempt++) {
      const joinCode = this.generateJoinCode();
      try {
        const created = await this.classesRepository.create({
          ...dto,
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
    let code = '';
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
    }
    return code;
  }

  private buildJoinCodeExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + JOIN_CODE_TTL_DAYS);
    return expiry;
  }
}
