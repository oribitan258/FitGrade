import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassWeightsDto } from './dto/update-class-weights.dto';
import { QuickGradeOverrideDto, QuickGradeResponseDto } from './dto/quick-grade-override.dto';
import { SemesterQueryDto } from './dto/semester-query.dto';
import { ClassResponseDto } from './dto/class-response.dto';
import { ClassDetailsResponseDto } from './dto/class-details-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('classes')
@Roles('TEACHER')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /**
   * Returns a paginated list of classes belonging to the authenticated teacher.
   * Ordered newest-first. Total item count is in the X-Total-Count response header.
   */
  @Get()
  @ApiOperation({ summary: 'List classes for the authenticated teacher (paginated)' })
  @ApiQuery({ name: 'take', required: false, description: 'Items per page (max 100)' })
  @ApiQuery({ name: 'skip', required: false, description: 'Offset' })
  @ApiResponse({ status: 200, type: [ClassResponseDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMyClasses(
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClassResponseDto[]> {
    const [data, total] = await this.classesService.getMyClasses(user.sub, pagination.take, pagination.skip);
    res.setHeader('X-Total-Count', total);
    return data;
  }

  /**
   * Returns a single class by ID.
   * Only accessible if the class belongs to the authenticated teacher.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single class by ID' })
  @ApiResponse({ status: 200, type: ClassResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getClassById(
    @Param('id') classId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ClassResponseDto> {
    return this.classesService.getClassById(classId, user.sub);
  }

  /**
   * Returns aggregated class details: per-test summaries (progress chart data,
   * grade distribution, per-student grades) and overall attendance percentage.
   * Used exclusively by the class detail page.
   */
  @Get(':id/details')
  @ApiOperation({ summary: 'Get aggregated class details for the class detail page' })
  @ApiResponse({ status: 200, type: ClassDetailsResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getClassDetails(
    @Param('id') classId: string,
    @Query() query: SemesterQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ClassDetailsResponseDto> {
    return this.classesService.getClassDetails(classId, user.sub, query.semester);
  }

  /**
   * Updates per-class grading weight overrides.
   * Pass null for both to reset to the teacher's global defaults.
   * When both are non-null they must sum to 100.
   */
  @Patch(':id/grading-policy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update per-class grading weight overrides' })
  @ApiResponse({ status: 200, type: ClassResponseDto })
  @ApiResponse({ status: 400, description: 'Weights do not sum to 100' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async updateClassWeights(
    @Param('id') classId: string,
    @Body() dto: UpdateClassWeightsDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ClassResponseDto> {
    return this.classesService.updateClassWeights(classId, user.sub, dto);
  }

  /**
   * Overrides the grade for the most recent test result for a student.
   * Used by the Grade Management Matrix for rapid inline edits.
   * Throws 404 if no prior result exists for this (student, testType, class) combination.
   */
  @Patch(':id/students/:studentId/grade-override')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quick-override a student grade (Grade Matrix)' })
  @ApiResponse({ status: 200, type: QuickGradeResponseDto })
  @ApiResponse({ status: 404, description: 'No existing result to override' })
  async setStudentGradeOverride(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
    @Body() dto: QuickGradeOverrideDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<QuickGradeResponseDto> {
    return this.classesService.setStudentGradeOverride(classId, studentId, dto, user.sub);
  }

  /**
   * Removes a student from a class roster.
   * Hard-deletes the ClassEnrollment row; historical results/attendance preserved.
   * Verifies the class belongs to the teacher before deletion.
   */
  @Delete(':id/students/:studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a student from a class roster' })
  @ApiResponse({ status: 204, description: 'Student removed' })
  @ApiResponse({ status: 403, description: 'Class belongs to a different teacher' })
  @ApiResponse({ status: 404, description: 'Class or enrollment not found' })
  async removeStudent(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.classesService.removeStudentFromClass(classId, studentId, user.sub);
  }

  /**
   * Creates a new class for the authenticated teacher.
   * Generates a unique join code automatically.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new class' })
  @ApiResponse({ status: 201, type: ClassResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async createClass(
    @Body() dto: CreateClassDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ClassResponseDto> {
    return this.classesService.createClass(dto, user.sub);
  }
}
