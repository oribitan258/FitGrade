import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditAction, FitnessInputType, Gender } from '@prisma/client';
import { GradingService } from '../grading/grading.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TestsRepository } from './tests.repository';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { TestTypeResponseDto } from './dto/test-type-response.dto';
import type { SessionResponseDto } from './dto/session-response.dto';
import type { SessionDetailResponseDto } from './dto/session-detail-response.dto';
import type { SubmitResultDto } from './dto/submit-result.dto';
import type { OverrideGradeDto } from './dto/override-grade.dto';
import type { ResultResponseDto } from './dto/result-response.dto';
import type { TestTypeNormsResponseDto } from './dto/norm-band-response.dto';

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(
    private readonly testsRepository: TestsRepository,
    private readonly gradingService: GradingService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Returns all available FitnessTestTypes (system catalog). */
  async getTestTypes(): Promise<TestTypeResponseDto[]> {
    return this.testsRepository.findAllTestTypes();
  }

  /**
   * Returns all NormTable bands for the given test type.
   * Frontend filters by gender + age group for a specific view.
   */
  async getNormBands(testTypeId: string): Promise<TestTypeNormsResponseDto> {
    return this.testsRepository.findNormBandsForTestType(testTypeId);
  }

  /**
   * Creates a new TestSession for a class.
   * Verifies the class belongs to the teacher and that the test type exists.
   */
  async createSession(
    classId: string,
    dto: CreateSessionDto,
    teacherId: string,
  ): Promise<SessionResponseDto> {
    await this.testsRepository.verifyClassOwnership(classId, teacherId);
    await this.testsRepository.verifyTestTypeExists(dto.testTypeId);

    const session = await this.testsRepository.createSession(
      classId,
      dto.testTypeId,
      dto.notes,
      dto.isStopwatch ?? false,
      dto.conductedAt !== undefined ? new Date(dto.conductedAt) : undefined,
      dto.semester,
    );

    this.logger.log(
      `Session created: id=${session.id} class=${classId} testType=${dto.testTypeId} teacher=${teacherId}`,
    );

    return session;
  }

  /**
   * Returns full session details including enrolled students and recorded results.
   * Verifies the session belongs to the teacher's class.
   */
  async getSessionWithStudents(
    sessionId: string,
    teacherId: string,
  ): Promise<SessionDetailResponseDto> {
    return this.testsRepository.findSessionWithStudents(sessionId, teacherId);
  }

  /**
   * Sets the server-side startedAt timestamp for stopwatch sessions.
   * Verifies session ownership before updating.
   */
  async startSession(
    sessionId: string,
    teacherId: string,
  ): Promise<SessionResponseDto> {
    await this.testsRepository.findSessionWithOwnership(sessionId, teacherId);
    const session = await this.testsRepository.startSession(sessionId);
    this.logger.log(`Session started: id=${sessionId} teacher=${teacherId}`);
    return session;
  }

  /**
   * Marks a session as completed by setting completedAt to now.
   * Verifies session ownership before updating.
   */
  async completeSession(
    sessionId: string,
    teacherId: string,
  ): Promise<SessionResponseDto> {
    await this.testsRepository.findSessionWithOwnership(sessionId, teacherId);
    const session = await this.testsRepository.completeSession(sessionId);
    this.logger.log(`Session completed: id=${sessionId} teacher=${teacherId}`);
    return session;
  }

  /**
   * Overrides the grade for an existing test result.
   *
   * 1. Verifies the session belongs to the teacher's class (ownership check).
   * 2. Applies the override grade and optional reason to the result.
   */
  async overrideGrade(
    sessionId: string,
    resultId: string,
    teacherId: string,
    dto: OverrideGradeDto,
  ): Promise<ResultResponseDto> {
    await this.testsRepository.findSessionWithOwnership(sessionId, teacherId);

    // sessionId is forwarded to the repository so the UPDATE is gated on
    // (resultId, sessionId) together — prevents cross-session override
    // even if the session ownership check above passes. (SEC-001)
    const result = await this.testsRepository.overrideResultGrade(
      resultId,
      sessionId,
      dto.gradeOverride,
      dto.overrideReason,
    );

    this.logger.log(
      `Grade overridden: result=${resultId} session=${sessionId} override=${dto.gradeOverride} teacher=${teacherId}`,
    );

    void this.auditLogService.log({
      action: AuditAction.GRADE_OVERRIDE,
      entityType: 'TestResult',
      entityId: result.id,
      actorId: teacherId,
      newValue: {
        gradeOverride: dto.gradeOverride,
        overrideReason: dto.overrideReason ?? null,
      },
    });

    return result;
  }

  /** Maximum ms after recording that a result may be deleted via undo. */
  private static readonly UNDO_WINDOW_MS = 30_000;

  /** Minimum rawValue (seconds) accepted for TIME-type tests. Prevents 0-second or absurd entries. */
  private static readonly MIN_TIME_SECONDS = 30;

  /**
   * Maximum duration a stopwatch session may run before new taps are rejected. (LOGIC-007)
   * 2 hours covers the longest realistic PE field session with generous margin.
   * Non-stopwatch (manual entry) sessions have no timer so this limit does not apply.
   */
  private static readonly MAX_STOPWATCH_DURATION_MS = 2 * 60 * 60 * 1000;

  /**
   * Distance-run gender restrictions per Ministry of Education curriculum.
   * Key: substring that appears in the test nameHe (e.g. '800', '1500').
   * Value: the ONLY gender permitted to take that distance test.
   */
  private static readonly DISTANCE_GENDER_RESTRICTIONS: Record<string, Gender> = {
    '800':  Gender.FEMALE,
    '1500': Gender.FEMALE,
    '2000': Gender.MALE,
    '3000': Gender.MALE,
  };

  /**
   * Deletes a single test result (undo / correction).
   * Verifies the session belongs to the teacher's class before deleting.
   * Enforces the 30-second undo window: results older than 30s cannot be deleted.
   */
  async deleteResult(
    sessionId: string,
    studentId: string,
    teacherId: string,
  ): Promise<void> {
    await this.testsRepository.findSessionWithOwnership(sessionId, teacherId);
    await this.testsRepository.deleteResult(
      sessionId,
      studentId,
      TestsService.UNDO_WINDOW_MS,
    );
    this.logger.log(
      `Result deleted: session=${sessionId} student=${studentId} teacher=${teacherId}`,
    );
    void this.auditLogService.log({
      action: AuditAction.RESULT_EDIT,
      entityType: 'TestResult',
      entityId: `${sessionId}/${studentId}`,
      actorId: teacherId,
      newValue: { deleted: true },
    });
  }

  /**
   * Submits a test result for a student in a session.
   *
   * 1. Verifies the session belongs to the teacher's class.
   * 2. Delegates grade calculation to GradingService (single source of truth).
   * 3. Persists the result with the calculated grade.
   */
  async submitResult(
    sessionId: string,
    dto: SubmitResultDto,
    teacherId: string,
  ): Promise<ResultResponseDto> {
    const { testTypeId, conductedAt, inputType, testNameHe, classId, isStopwatch, startedAt } =
      await this.testsRepository.findSessionWithOwnership(sessionId, teacherId);

    // Verify the student is enrolled in the session's class before grading.
    // Prevents results being written for students from other classes. (LOGIC-003)
    await this.testsRepository.verifyStudentEnrolled(dto.studentId, classId);

    // Reject stopwatch taps for sessions that have been running too long. (LOGIC-007)
    // Manual-entry sessions have no server-side timer so this guard is skipped for them.
    if (
      isStopwatch &&
      startedAt !== null &&
      Date.now() - startedAt.getTime() > TestsService.MAX_STOPWATCH_DURATION_MS
    ) {
      throw new BadRequestException(
        'המפגש פתוח יותר מדי זמן — יש לסיים אותו וליצור מפגש חדש',
      );
    }

    if (inputType === FitnessInputType.TIME && Number(dto.rawValue) < TestsService.MIN_TIME_SECONDS) {
      throw new BadRequestException(`ערך זמן מינימלי הוא ${TestsService.MIN_TIME_SECONDS} שניות`);
    }

    // Gender restriction validation for distance-run tests
    if (inputType === FitnessInputType.TIME) {
      const restrictionEntry = Object.entries(TestsService.DISTANCE_GENDER_RESTRICTIONS)
        .find(([distanceKey]) => testNameHe.includes(distanceKey));
      if (restrictionEntry !== undefined) {
        const [, requiredGender] = restrictionEntry;
        const studentGender = await this.gradingService.getStudentGender(dto.studentId);
        const genderLabel = requiredGender === Gender.FEMALE ? 'בנות' : 'בנים';
        if (studentGender !== requiredGender) {
          throw new BadRequestException(`מבחן זה מיועד ל${genderLabel} בלבד`);
        }
      }
    }

    const calculatedGrade = await this.gradingService.calculateGrade(
      dto.studentId,
      testTypeId,
      dto.rawValue,
      classId,
    );

    const result = await this.testsRepository.createResult(
      sessionId,
      dto.studentId,
      dto.rawValue,
      calculatedGrade,
    );

    this.logger.log(
      `Result submitted: session=${sessionId} student=${dto.studentId} rawValue=${dto.rawValue} grade=${calculatedGrade}`,
    );

    void this.auditLogService.log({
      action: AuditAction.GRADE_ENTRY,
      entityType: 'TestResult',
      entityId: result.id,
      actorId: teacherId,
      newValue: {
        sessionId,
        studentId: dto.studentId,
        rawValue: dto.rawValue,
        calculatedGrade,
      },
    });

    return result;
  }
}
