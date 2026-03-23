import { Injectable, Logger } from '@nestjs/common';
import { GradingService } from '../grading/grading.service';
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

    const result = await this.testsRepository.overrideResultGrade(
      resultId,
      dto.gradeOverride,
      dto.overrideReason,
    );

    this.logger.log(
      `Grade overridden: result=${resultId} session=${sessionId} override=${dto.gradeOverride} teacher=${teacherId}`,
    );

    return result;
  }

  /**
   * Deletes a single test result (undo / correction).
   * Verifies the session belongs to the teacher's class before deleting.
   */
  async deleteResult(
    sessionId: string,
    studentId: string,
    teacherId: string,
  ): Promise<void> {
    await this.testsRepository.findSessionWithOwnership(sessionId, teacherId);
    await this.testsRepository.deleteResult(sessionId, studentId);
    this.logger.log(
      `Result deleted: session=${sessionId} student=${studentId} teacher=${teacherId}`,
    );
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
    const { testTypeId } = await this.testsRepository.findSessionWithOwnership(
      sessionId,
      teacherId,
    );

    const calculatedGrade = await this.gradingService.calculateGrade(
      dto.studentId,
      testTypeId,
      dto.rawValue,
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

    return result;
  }
}
