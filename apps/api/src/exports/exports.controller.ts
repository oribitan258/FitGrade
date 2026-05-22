import {
  Controller,
  Get,
  Param,
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
import { ExportsService } from './exports.service';
import { SemesterQueryDto } from '../classes/dto/semester-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('exports')
@Roles('TEACHER')
@ApiBearerAuth()
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  /**
   * Streams a native .xlsx workbook for the given class.
   * Hebrew column headers, one row per student.
   * Optional ?semester=A|B scopes the data to that semester.
   */
  @Get('excel/:classId')
  @ApiOperation({ summary: 'Download class report as .xlsx (Hebrew headers, one row per student)' })
  @ApiResponse({ status: 200, description: 'Returns .xlsx binary stream' })
  @ApiResponse({ status: 403, description: 'Class does not belong to caller' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async downloadExcel(
    @Param('classId') classId: string,
    @Query() query: SemesterQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, className } = await this.exportsService.buildExcel(
      classId,
      user.sub,
      query.semester,
    );

    const semSuffix = query.semester ? `-${query.semester}` : '';
    const filename = encodeURIComponent(`דוח-${className}${semSuffix}.xlsx`);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  /**
   * Streams a .pdf for the given class (RTL Hebrew layout).
   * Requires a Unicode font with Hebrew glyphs on the server host —
   * install fonts-dejavu-core (apt-get) for Linux/Docker deployments.
   */
  @Get('pdf/:classId')
  @ApiOperation({ summary: 'Download class report as .pdf (RTL Hebrew layout)' })
  @ApiResponse({ status: 200, description: 'Returns PDF binary stream' })
  @ApiResponse({ status: 403, description: 'Class does not belong to caller' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async downloadPdf(
    @Param('classId') classId: string,
    @Query() query: SemesterQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, className } = await this.exportsService.buildPdf(
      classId,
      user.sub,
      query.semester,
    );

    const semSuffix = query.semester ? `-${query.semester}` : '';
    const filename = encodeURIComponent(`דוח-${className}${semSuffix}.pdf`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
