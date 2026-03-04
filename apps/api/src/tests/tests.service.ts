import { Injectable, Logger } from '@nestjs/common';
import { GradingService } from '../grading/grading.service';
import { TestsRepository } from './tests.repository';
import type { CreateSessionDto } from './dto/create-session.dto';
import type { TestTypeResponseDto } from './dto/test-type-response.dto';
import type { SessionResponseDto } from './dto/session-response.dto';
import type { SubmitResultDto } from './dto/submit-result.dto';
import type { ResultResponseDto } from './dto/result-response.dto';

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
    );

    this.logger.log(
      `Session created: id=${session.id} class=${classId} testType=${dto.testTypeId} teacher=${teacherId}`,
    );

    return session;
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
