import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { StudentPortalService } from './student-portal.service';
import {
  StudentAttendanceSummaryDto,
  StudentResultDto,
} from './dto/student-portal.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

/**
 * Student self-service portal — read-only data for the authenticated student.
 *
 * @Roles('STUDENT') ensures only student JWTs can reach these endpoints.
 * The service further scopes every query to jwtPayload.sub so a student
 * can only ever read their own records. (SEC-004)
 */
@ApiTags('student-portal')
@ApiBearerAuth()
@Roles('STUDENT')
@Controller('students/me')
export class StudentPortalController {
  constructor(private readonly studentPortalService: StudentPortalService) {}

  @Get('attendance')
  @ApiOperation({ summary: "Fetch the authenticated student's attendance summary" })
  @ApiResponse({ status: 200, type: StudentAttendanceSummaryDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Teacher tokens are not permitted on student-portal endpoints' })
  async getMyAttendance(
    @CurrentUser() user: JwtPayload,
  ): Promise<StudentAttendanceSummaryDto> {
    return this.studentPortalService.getMyAttendance(user.sub);
  }

  @Get('results')
  @ApiOperation({ summary: "Fetch the authenticated student's test results" })
  @ApiResponse({ status: 200, type: [StudentResultDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Teacher tokens are not permitted on student-portal endpoints' })
  async getMyResults(@CurrentUser() user: JwtPayload): Promise<StudentResultDto[]> {
    return this.studentPortalService.getMyResults(user.sub);
  }
}
