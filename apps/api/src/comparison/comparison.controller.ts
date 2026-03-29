import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ComparisonService } from './comparison.service';
import {
  ClassComparisonResponseDto,
  ComparisonAvailabilityDto,
} from './dto/comparison.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('comparison')
@ApiBearerAuth()
@Controller('classes/:classId/comparison')
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  /**
   * Lightweight check: returns whether Semester B has any test results for
   * this class. Used by the frontend to enable/disable the comparison button.
   * Ownership is verified in the service before the count query runs.
   */
  @Get('availability')
  @ApiOperation({ summary: 'Check if Semester B data is available for comparison' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiResponse({ status: 200, type: ComparisonAvailabilityDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found or does not belong to this teacher' })
  async getAvailability(
    @Param('classId') classId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ComparisonAvailabilityDto> {
    return this.comparisonService.getAvailability(classId, user.sub);
  }

  /**
   * Returns the full semester A vs B comparison for a class.
   * Aggregates all test results in a single DB round-trip, then computes
   * per-test averages, grade distributions, per-student grades, and deltas
   * entirely in-memory.
   */
  @Get()
  @ApiOperation({ summary: 'Get semester A vs B comparison for a class' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiResponse({ status: 200, type: ClassComparisonResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found or does not belong to this teacher' })
  async getComparison(
    @Param('classId') classId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ClassComparisonResponseDto> {
    return this.comparisonService.getComparison(classId, user.sub);
  }
}
