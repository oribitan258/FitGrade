import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { SaveReportGradesDto } from './dto/save-report-grades.dto';
import { ReportRowDto } from './dto/report-row.dto';
import { SemesterQueryDto } from '../classes/dto/semester-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('reports')
@Roles('TEACHER')
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
    @Query() query: SemesterQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReportRowDto[]> {
    return this.reportsService.getClassReport(classId, user.sub, query.semester);
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
   * Streams a UTF-8 BOM CSV of the class final-grades report.
   * Columns: שם פרטי, שם משפחה, קוד תלמיד, ממוצע כושר, ניהול, ציון מומלץ, ציון מורה, הערה.
   */
  @Get('class/:classId/export/csv')
  @ApiOperation({ summary: 'Download class final-grades as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 403, description: 'Not a teacher or class not owned' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async exportClassCsv(
    @Param('classId') classId: string,
    @Query() query: SemesterQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const rows = await this.reportsService.getClassReport(classId, user.sub, query.semester);

    const HEADERS = ['שם פרטי', 'שם משפחה', 'קוד תלמיד', 'ממוצע כושר', 'ניהול', 'ציון מומלץ', 'ציון מורה', 'הערה'];

    const escape = (v: string | number | null | undefined): string => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const lines = [
      HEADERS.join(','),
      ...rows.map((r) =>
        [
          r.firstName,
          r.lastName,
          r.studentCode,
          r.fitnessAvg,
          r.conductScore,
          r.recommendedFinalGrade,
          r.teacherFinalGrade ?? '',
          r.verbalComment ?? r.suggestedComment,
        ]
          .map(escape)
          .join(','),
      ),
    ];

    // UTF-8 BOM so Excel opens Hebrew correctly
    const csv = '\uFEFF' + lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fitgrade-class-${classId}.csv"`);
    res.send(csv);
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
