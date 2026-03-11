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
  TopStudentItemDto,
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
}
