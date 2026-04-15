import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { GetAttendanceQueryDto } from './dto/get-attendance-query.dto';
import { AttendanceResponseDto } from './dto/attendance-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('attendance')
@Roles('TEACHER')
@ApiBearerAuth()
@Controller('classes/:classId/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Returns all attendance records for a class on a given date.
   * Pass ?date=YYYY-MM-DD to specify the date.
   */
  @Get()
  @ApiOperation({ summary: 'Get attendance records for a class on a specific date' })
  @ApiResponse({ status: 200, type: [AttendanceResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getAttendance(
    @Param('classId') classId: string,
    @Query() query: GetAttendanceQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AttendanceResponseDto[]> {
    return this.attendanceService.getAttendance(classId, query.date, user.sub, query.activeOnly);
  }

  /**
   * Bulk-saves or updates attendance records for a class.
   * Uses upsert semantics: existing records on the given date are updated,
   * new ones are created. Returns the full list after saving.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk save or update attendance for a class' })
  @ApiResponse({ status: 200, type: [AttendanceResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async saveAttendance(
    @Param('classId') classId: string,
    @Body() dto: BulkAttendanceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AttendanceResponseDto[]> {
    return this.attendanceService.saveAttendance(classId, dto, user.sub);
  }
}
