import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardStatsResponseDto } from './dto/dashboard-stats-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Returns aggregated fitness, attendance, and session stats for the
   * authenticated teacher's classes.
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get aggregated dashboard stats for the authenticated teacher' })
  @ApiResponse({ status: 200, type: DashboardStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getStats(@CurrentUser() user: JwtPayload): Promise<DashboardStatsResponseDto> {
    return this.dashboardService.getStats(user.sub);
  }
}
