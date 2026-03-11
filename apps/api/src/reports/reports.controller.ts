import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { SaveReportGradesDto } from './dto/save-report-grades.dto';
import { ReportRowDto } from './dto/report-row.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Returns the full class final-grades report with smart verbal comment
   * suggestions and any previously saved teacher overrides.
   */
  @Get('class/:classId')
  @ApiOperation({ summary: 'Get class final-grades report with smart comment suggestions' })
  @ApiResponse({ status: 200, description: 'Report rows', type: [ReportRowDto] })
  @ApiResponse({ status: 403, description: 'Not a teacher or class not owned' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getClassReport(
    @Param('classId') classId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReportRowDto[]> {
    return this.reportsService.getClassReport(classId, user.sub);
  }

  /**
   * Saves teacher overrides (final grade + verbal comment) for multiple students.
   * Partial saves are allowed — only provided students are updated.
   */
  @Patch('class/:classId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Save teacher final grade and verbal comment overrides' })
  @ApiResponse({ status: 204, description: 'Saved successfully' })
  @ApiResponse({ status: 403, description: 'Not a teacher or class not owned' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async saveGradeOverrides(
    @Param('classId') classId: string,
    @Body() dto: SaveReportGradesDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.reportsService.saveGradeOverrides(classId, user.sub, dto.grades);
  }

  /**
   * Returns the full Ministry comments bank.
   * Used to populate the Combobox on the frontend.
   */
  @Get('comments-bank')
  @ApiOperation({ summary: 'Get the Ministry of Education verbal comments bank' })
  @ApiResponse({ status: 200, description: 'List of predefined comments', type: [String] })
  getCommentsBank(): string[] {
    return this.reportsService.getCommentsBank();
  }
}
