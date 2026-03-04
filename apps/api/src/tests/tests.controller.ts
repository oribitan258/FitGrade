import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TestsService } from './tests.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SubmitResultDto } from './dto/submit-result.dto';
import { TestTypeResponseDto } from './dto/test-type-response.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { ResultResponseDto } from './dto/result-response.dto';
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
}
