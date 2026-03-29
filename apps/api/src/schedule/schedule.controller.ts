import { Controller, Get, Put, Delete, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { TodayScheduleItemDto } from './dto/today-schedule-item.dto';
import { UpsertScheduleEntryDto } from './dto/upsert-schedule-entry.dto';
import { SemesterQueryDto } from '../common/dto/semester-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('schedule')
@ApiBearerAuth()
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('today')
  @ApiOperation({ summary: "Get authenticated teacher's schedule for today with real-time status labels" })
  @ApiResponse({ status: 200, type: [TodayScheduleItemDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getToday(
    @CurrentUser() user: JwtPayload,
    @Query() query: SemesterQueryDto,
  ): Promise<TodayScheduleItemDto[]> {
    return this.scheduleService.getTodaySchedule(user.sub, query.semester);
  }

  @Put(':dayOfWeek/:period')
  @ApiOperation({ summary: 'Upsert a schedule slot (assign a class to a day+period for a semester)' })
  @ApiResponse({ status: 200, description: 'Slot saved' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async upsertEntry(
    @CurrentUser() user: JwtPayload,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Param('period', ParseIntPipe) period: number,
    @Body() dto: UpsertScheduleEntryDto,
  ): Promise<void> {
    await this.scheduleService.upsertEntry(
      user.sub,
      dayOfWeek,
      period,
      dto.startTime,
      dto.classId,
      dto.semester,
    );
  }

  @Delete(':dayOfWeek/:period')
  @ApiOperation({ summary: 'Remove a class from a schedule slot for a semester' })
  @ApiResponse({ status: 200, description: 'Slot cleared' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async deleteEntry(
    @CurrentUser() user: JwtPayload,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Param('period', ParseIntPipe) period: number,
    @Query() query: SemesterQueryDto,
  ): Promise<void> {
    await this.scheduleService.deleteEntry(user.sub, dayOfWeek, period, query.semester);
  }
}
