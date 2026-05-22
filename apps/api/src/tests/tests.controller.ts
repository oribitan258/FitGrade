import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TestsService } from './tests.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SubmitResultDto } from './dto/submit-result.dto';
import { OverrideGradeDto } from './dto/override-grade.dto';
import { TestTypeResponseDto } from './dto/test-type-response.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { SessionDetailResponseDto } from './dto/session-detail-response.dto';
import { ResultResponseDto } from './dto/result-response.dto';
import { TestTypeNormsResponseDto } from './dto/norm-band-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { EditResultRawValueDto } from './dto/edit-result-raw-value.dto';
import { SessionHistoryRowDto } from './dto/session-history-row.dto';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

/**
 * TestsController handles three related resources under separate paths:
 *   GET  /tests/types                       — fitness test catalog
 *   POST /classes/:classId/sessions         — create a grading session
 *   POST /sessions/:sessionId/results       — submit a student result
 *
 * Using @Controller() with no prefix allows these varied path patterns
 * to live in one cohesive module without forcing an artificial prefix.
 */
@Roles('TEACHER')
@ApiBearerAuth()
@Controller()
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  /**
   * Returns all available fitness test types (system catalog).
   * Used to populate the test-type picker in the mobile app and web UI.
   */
  @Get('tests/types')
  @ApiTags('tests')
  @ApiOperation({ summary: 'List all available fitness test types' })
  @ApiResponse({ status: 200, type: [TestTypeResponseDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getTestTypes(): Promise<TestTypeResponseDto[]> {
    return this.testsService.getTestTypes();
  }

  /**
   * Returns all NormTable bands for a specific test type.
   * Frontend filters by gender + (minAge, maxAge) for a specific table view.
   */
  @Get('tests/types/norms')
  @ApiTags('tests')
  @ApiOperation({ summary: 'Get all norm bands for a specific test type' })
  @ApiQuery({ name: 'testTypeId', required: true, description: 'FitnessTestType ID' })
  @ApiResponse({ status: 200, type: TestTypeNormsResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Test type not found' })
  async getTestTypeNorms(
    @Query('testTypeId') testTypeId: string,
  ): Promise<TestTypeNormsResponseDto> {
    return this.testsService.getNormBands(testTypeId);
  }

  /**
   * Creates a new test session for a class.
   * Only the class's teacher may create sessions.
   */
  @Post('classes/:classId/sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('sessions')
  @ApiOperation({ summary: 'Create a new test session for a class' })
  @ApiResponse({ status: 201, type: SessionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class or test type not found' })
  async createSession(
    @Param('classId') classId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionResponseDto> {
    return this.testsService.createSession(classId, dto, user.sub);
  }

  /**
   * Returns full session details: test metadata, enrolled students, and all
   * results recorded so far. Powers the live-session page on initial load.
   */
  @Get('sessions/:sessionId')
  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get live session details (students + results)' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, type: SessionDetailResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Session not found or not accessible' })
  async getSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionDetailResponseDto> {
    return this.testsService.getSessionWithStudents(sessionId, user.sub);
  }

  /**
   * Submits a student test result for a session.
   * GradingService automatically calculates calculatedGrade from rawValue and norm tables.
   */
  @Post('sessions/:sessionId/results')
  @HttpCode(HttpStatus.CREATED)
  @ApiTags('results')
  @ApiOperation({ summary: 'Submit a student result for a test session' })
  @ApiResponse({ status: 201, type: ResultResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Session, student, or norm table row not found' })
  @ApiResponse({ status: 409, description: 'Result already submitted for this student+session' })
  async submitResult(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitResultDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ResultResponseDto> {
    return this.testsService.submitResult(sessionId, dto, user.sub);
  }

  /**
   * Starts the server-side stopwatch for a session (sets startedAt to now).
   * Idempotent — safe to call multiple times; only the first call is meaningful.
   */
  @Post('sessions/:sessionId/start')
  @HttpCode(HttpStatus.OK)
  @ApiTags('sessions')
  @ApiOperation({ summary: 'Start the server-side stopwatch for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async startSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionResponseDto> {
    return this.testsService.startSession(sessionId, user.sub);
  }

  /**
   * Marks a session as completed (sets completedAt to now).
   * Called when the teacher taps "End Session".
   */
  @Patch('sessions/:sessionId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiTags('sessions')
  @ApiOperation({ summary: 'Mark a session as completed' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, type: SessionResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async completeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionResponseDto> {
    return this.testsService.completeSession(sessionId, user.sub);
  }

  /**
   * Overrides the calculated grade for a specific test result.
   * Used in the beep test post-summary and any manual grade correction flow.
   */
  @Patch('sessions/:sessionId/results/:resultId')
  @HttpCode(HttpStatus.OK)
  @ApiTags('results')
  @ApiOperation({ summary: 'Override the grade for a test result' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'resultId', description: 'TestResult ID' })
  @ApiResponse({ status: 200, type: ResultResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Session or result not found' })
  async overrideGrade(
    @Param('sessionId') sessionId: string,
    @Param('resultId') resultId: string,
    @Body() dto: OverrideGradeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ResultResponseDto> {
    return this.testsService.overrideGrade(sessionId, resultId, user.sub, dto);
  }

  /**
   * Deletes a student's result from a session (undo / correction).
   * The student immediately becomes eligible for re-tapping.
   */
  @Delete('sessions/:sessionId/results/:studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('results')
  @ApiOperation({ summary: 'Delete a student result (undo)' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ status: 204, description: 'Result deleted' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Result not found' })
  async deleteResult(
    @Param('sessionId') sessionId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.testsService.deleteResult(sessionId, studentId, user.sub);
  }

  // ─── History endpoints ────────────────────────────────────────────────────

  /**
   * Returns paginated session history for a class.
   * Total count is emitted as X-Total-Count response header for the client
   * to implement "load more" or pagination UI without a separate count request.
   */
  @Get('classes/:classId/sessions')
  @ApiTags('sessions')
  @ApiOperation({ summary: 'List past sessions for a class (paginated history)' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiResponse({
    status: 200,
    type: [SessionHistoryRowDto],
    headers: {
      'X-Total-Count': {
        description: 'Total number of sessions for this class',
        schema: { type: 'integer' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Class belongs to another teacher' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getSessionHistory(
    @Param('classId') classId: string,
    @Query() pagination: PaginationQueryDto,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionHistoryRowDto[]> {
    const { rows, total } = await this.testsService.getSessionsByClass(classId, user.sub, pagination);
    res.setHeader('X-Total-Count', String(total));
    return rows;
  }

  /**
   * Edits the raw measurement value of a result in history and recalculates the grade.
   * Applies the same validations as initial result submission (time minimums, gender restrictions).
   */
  @Patch('sessions/:sessionId/results/:resultId/raw-value')
  @HttpCode(HttpStatus.OK)
  @ApiTags('results')
  @ApiOperation({ summary: 'Edit raw value of a history result (recalculates grade)' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'resultId', description: 'TestResult ID' })
  @ApiResponse({ status: 200, type: ResultResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input or validation failure' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Session or result not found' })
  async editResultRawValue(
    @Param('sessionId') sessionId: string,
    @Param('resultId') resultId: string,
    @Body() dto: EditResultRawValueDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ResultResponseDto> {
    return this.testsService.editResultRawValue(resultId, sessionId, dto.rawValue, user.sub);
  }

  /**
   * Deletes a single result from history — no undo window.
   * The confirmation dialog in the UI is the only safety gate.
   */
  @Delete('sessions/:sessionId/results/:resultId/history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('results')
  @ApiOperation({ summary: 'Delete a result from history (no undo window)' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'resultId', description: 'TestResult ID' })
  @ApiResponse({ status: 204, description: 'Result deleted' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Session or result not found' })
  async deleteResultInHistory(
    @Param('sessionId') sessionId: string,
    @Param('resultId') resultId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.testsService.deleteResultInHistory(resultId, sessionId, user.sub);
  }

  /**
   * Deletes an entire session.
   * TestResults cascade-delete; AttendanceRecord.sessionId is nulled.
   * Irreversible — requires confirmation dialog on the client.
   */
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('sessions')
  @ApiOperation({ summary: 'Delete an entire session and all its results' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 204, description: 'Session deleted' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Session belongs to another teacher' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.testsService.deleteSession(sessionId, user.sub);
  }
}
