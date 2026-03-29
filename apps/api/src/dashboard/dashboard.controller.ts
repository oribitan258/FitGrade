import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SemesterQueryDto } from '../common/dto/semester-query.dto';
import { DashboardService } from './dashboard.service';
import {
  BelowNormItemDto,
  DashboardStatsResponseDto,
  MissingResultItemDto,
  MonthlyClassAverageDto,
  TopAchievementItemDto,
  TopStudentItemDto,
  TopStudentPerClassItemDto,
} from './dto/dashboard-stats-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregated dashboard stats for the authenticated teacher' })
  @ApiQuery({ name: 'semester', enum: ['A', 'B'], required: false, description: 'Filter by semester' })
  @ApiResponse({ status: 200, type: DashboardStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getStats(
    @CurrentUser() user: JwtPayload,
    @Query() query: SemesterQueryDto,
  ): Promise<DashboardStatsResponseDto> {
    return this.dashboardService.getStats(user.sub, query.semester);
  }

  @Get('missing-results')
  @ApiOperation({ summary: 'List all student/session pairs missing a test result' })
  @ApiQuery({ name: 'semester', enum: ['A', 'B'], required: false, description: 'Filter by semester' })
  @ApiResponse({ status: 200, type: [MissingResultItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMissingResults(
    @CurrentUser() user: JwtPayload,
    @Query() query: SemesterQueryDto,
  ): Promise<MissingResultItemDto[]> {
    return this.dashboardService.getMissingResults(user.sub, query.semester);
  }

  @Get('below-norm-details')
  @ApiOperation({ summary: 'List all individual test results that are below the norm threshold' })
  @ApiQuery({ name: 'semester', enum: ['A', 'B'], required: false, description: 'Filter by semester' })
  @ApiResponse({ status: 200, type: [BelowNormItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getBelowNormDetails(
    @CurrentUser() user: JwtPayload,
    @Query() query: SemesterQueryDto,
  ): Promise<BelowNormItemDto[]> {
    return this.dashboardService.getBelowNormDetails(user.sub, query.semester);
  }

  @Get('top-students')
  @ApiOperation({ summary: 'Get top performing students ranked by average grade across all teacher classes. Pass testTypeId to filter by a specific test.' })
  @ApiQuery({ name: 'semester', enum: ['A', 'B'], required: false, description: 'Filter by semester' })
  @ApiResponse({ status: 200, type: [TopStudentItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getTopStudents(
    @CurrentUser() user: JwtPayload,
    @Query('testTypeId') testTypeId: string | undefined,
    @Query() query: SemesterQueryDto,
  ): Promise<TopStudentItemDto[]> {
    return this.dashboardService.getTopStudents(user.sub, testTypeId, query.semester);
  }

  @Get('top-achievements')
  @ApiOperation({ summary: 'Get top individual test achievements across all teacher classes, one best result per student, ordered by score descending.' })
  @ApiQuery({ name: 'semester', enum: ['A', 'B'], required: false, description: 'Filter by semester' })
  @ApiResponse({ status: 200, type: [TopAchievementItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getTopAchievements(
    @CurrentUser() user: JwtPayload,
    @Query() query: SemesterQueryDto,
  ): Promise<TopAchievementItemDto[]> {
    return this.dashboardService.getTopAchievements(user.sub, query.semester);
  }

  @Get('top-per-class')
  @ApiOperation({ summary: 'Get top 3 students per class ranked by average grade across all their results.' })
  @ApiQuery({ name: 'semester', enum: ['A', 'B'], required: false, description: 'Filter by semester' })
  @ApiResponse({ status: 200, type: [TopStudentPerClassItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getTopStudentsPerClass(
    @CurrentUser() user: JwtPayload,
    @Query() query: SemesterQueryDto,
  ): Promise<TopStudentPerClassItemDto[]> {
    return this.dashboardService.getTopStudentsPerClass(user.sub, query.semester);
  }

  @Get('class-averages')
  @ApiOperation({ summary: 'Get monthly average grades per class for trend charting — replaces hardcoded mock data.' })
  @ApiQuery({ name: 'semester', enum: ['A', 'B'], required: false, description: 'Filter by semester' })
  @ApiResponse({ status: 200, type: [MonthlyClassAverageDto], description: 'Array sorted by month ascending' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getClassAverages(
    @CurrentUser() user: JwtPayload,
    @Query() query: SemesterQueryDto,
  ): Promise<MonthlyClassAverageDto[]> {
    return this.dashboardService.getClassAverages(user.sub, query.semester);
  }
}
