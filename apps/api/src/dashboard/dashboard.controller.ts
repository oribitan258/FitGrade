import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import {
  BelowNormItemDto,
  DashboardStatsResponseDto,
  MissingResultItemDto,
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
  @ApiResponse({ status: 200, type: DashboardStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getStats(@CurrentUser() user: JwtPayload): Promise<DashboardStatsResponseDto> {
    return this.dashboardService.getStats(user.sub);
  }

  @Get('missing-results')
  @ApiOperation({ summary: 'List all student/session pairs missing a test result' })
  @ApiResponse({ status: 200, type: [MissingResultItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMissingResults(
    @CurrentUser() user: JwtPayload,
  ): Promise<MissingResultItemDto[]> {
    return this.dashboardService.getMissingResults(user.sub);
  }

  @Get('below-norm-details')
  @ApiOperation({ summary: 'List all individual test results that are below the norm threshold' })
  @ApiResponse({ status: 200, type: [BelowNormItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getBelowNormDetails(
    @CurrentUser() user: JwtPayload,
  ): Promise<BelowNormItemDto[]> {
    return this.dashboardService.getBelowNormDetails(user.sub);
  }

  @Get('top-students')
  @ApiOperation({ summary: 'Get top performing students ranked by average grade across all teacher classes. Pass testTypeId to filter by a specific test.' })
  @ApiResponse({ status: 200, type: [TopStudentItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getTopStudents(
    @CurrentUser() user: JwtPayload,
    @Query('testTypeId') testTypeId?: string,
  ): Promise<TopStudentItemDto[]> {
    return this.dashboardService.getTopStudents(user.sub, testTypeId);
  }

  @Get('top-achievements')
  @ApiOperation({ summary: 'Get top individual test achievements across all teacher classes, one best result per student, ordered by score descending.' })
  @ApiResponse({ status: 200, type: [TopAchievementItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getTopAchievements(
    @CurrentUser() user: JwtPayload,
  ): Promise<TopAchievementItemDto[]> {
    return this.dashboardService.getTopAchievements(user.sub);
  }

  @Get('top-per-class')
  @ApiOperation({ summary: 'Get top 3 students per class ranked by average grade across all their results.' })
  @ApiResponse({ status: 200, type: [TopStudentPerClassItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getTopStudentsPerClass(
    @CurrentUser() user: JwtPayload,
  ): Promise<TopStudentPerClassItemDto[]> {
    return this.dashboardService.getTopStudentsPerClass(user.sub);
  }
}
