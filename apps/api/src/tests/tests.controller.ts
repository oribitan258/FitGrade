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
} from '@nestjs/common';
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
import { TestTypeResponseDto } from './dto/test-type-response.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { SessionDetailResponseDto } from './dto/session-detail-response.dto';
import { ResultResponseDto } from './dto/result-response.dto';
import { TestTypeNormsResponseDto } from './dto/norm-band-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
}
