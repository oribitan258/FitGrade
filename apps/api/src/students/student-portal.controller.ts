import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StudentPortalService } from './student-portal.service';
import {
  StudentAttendanceSummaryDto,
  StudentResultDto,
} from './dto/student-portal.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

/**
 * Student self-service portal endpoints.
 *
 * Security model: these routes accept any valid JWT (teacher or student).
 * The service layer uses `jwtPayload.sub` as the studentId directly, so:
 *  - A student token → returns that student's own data only.
 *  - A teacher token → the UUID won't match any studentId → returns empty data.
 *
 * No additional @Roles guard is needed because the query itself is scoped
 * to the authenticated identity.
 */
@ApiTags('student-portal')
@ApiBearerAuth()
@Controller('students/me')
export class StudentPortalController {
  constructor(private readonly studentPortalService: StudentPortalService) {}

  @Get('attendance')
  @ApiOperation({ summary: "Fetch the authenticated student's attendance summary" })
  @ApiResponse({ status: 200, type: StudentAttendanceSummaryDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMyAttendance(
    @CurrentUser() user: JwtPayload,
  ): Promise<StudentAttendanceSummaryDto> {
    return this.studentPortalService.getMyAttendance(user.sub);
  }

  @Get('results')
  @ApiOperation({ summary: "Fetch the authenticated student's test results" })
  @ApiResponse({ status: 200, type: [StudentResultDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMyResults(@CurrentUser() user: JwtPayload): Promise<StudentResultDto[]> {
    return this.studentPortalService.getMyResults(user.sub);
  }
}
