import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  GradingPolicyResponseDto,
  UpdateGradingPolicyDto,
} from './dto/grading-policy.dto';
import {
  ReportSettingsResponseDto,
  UpdateReportSettingsDto,
} from './dto/report-settings.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Returns the teacher's global grading policy (fitness vs. conduct weights). */
  @Get('grading-policy')
  @ApiOperation({ summary: "Get teacher's global grading policy weights" })
  @ApiResponse({ status: 200, type: GradingPolicyResponseDto })
  async getGradingPolicy(
    @CurrentUser() user: JwtPayload,
  ): Promise<GradingPolicyResponseDto> {
    return this.settingsService.getGradingPolicy(user.sub);
  }

  /** Updates the teacher's global grading policy defaults. fitnessWeight + conductWeight must equal 100. */
  @Patch('grading-policy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update teacher's global grading policy weights" })
  @ApiResponse({ status: 200, type: GradingPolicyResponseDto })
  @ApiResponse({ status: 400, description: 'Weights do not sum to 100' })
  async updateGradingPolicy(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateGradingPolicyDto,
  ): Promise<GradingPolicyResponseDto> {
    return this.settingsService.updateGradingPolicy(user.sub, dto);
  }

  /** Returns the teacher's report & grading-presentation settings. */
  @Get('report-settings')
  @ApiOperation({ summary: "Get teacher's report and grading presentation settings" })
  @ApiResponse({ status: 200, type: ReportSettingsResponseDto })
  async getReportSettings(
    @CurrentUser() user: JwtPayload,
  ): Promise<ReportSettingsResponseDto> {
    return this.settingsService.getReportSettings(user.sub);
  }

  /** Updates report settings fields. All fields are optional — only provided fields are updated. */
  @Patch('report-settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update teacher's report and grading presentation settings" })
  @ApiResponse({ status: 200, type: ReportSettingsResponseDto })
  async updateReportSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateReportSettingsDto,
  ): Promise<ReportSettingsResponseDto> {
    return this.settingsService.updateReportSettings(user.sub, dto);
  }
}
