import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StudentsService } from './students.service';
import type { ImportResultDto } from './dto/import-students.dto';
import { SemesterQueryDto } from '../classes/dto/semester-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTalmidautDto } from './dto/create-talmidaut.dto';
import { StudentResponseDto } from './dto/student-response.dto';
import { StudentProfileResponseDto } from './dto/student-profile-response.dto';
import { StudentReportResponseDto } from './dto/student-report-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import type { FinalGradeResult } from './students.repository';

@ApiTags('students')
@Roles('TEACHER')
@ApiBearerAuth()
@Controller('classes/:classId/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /**
   * Returns a paginated list of students enrolled in the given class.
   * Total item count is in the X-Total-Count response header.
   */
  @Get()
  @ApiOperation({ summary: 'List students enrolled in a class (paginated)' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiQuery({ name: 'take', required: false, description: 'Items per page (max 100)' })
  @ApiQuery({ name: 'skip', required: false, description: 'Offset' })
  @ApiResponse({ status: 200, type: [StudentResponseDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getStudentsByClass(
    @Param('classId') classId: string,
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StudentResponseDto[]> {
    const [data, total] = await this.studentsService.getStudentsByClass(classId, user.sub, pagination.take, pagination.skip);
    res.setHeader('X-Total-Count', total);
    return data;
  }

  /**
   * Returns the full profile for a single student within a class,
   * including per-test score history, attendance metrics, talmidaut records,
   * and the recommended final grade.
   * Only accessible by the teacher who owns the class.
   */
  @Get(':studentId/profile')
  @ApiOperation({ summary: 'Get full profile for a student in a class' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ status: 200, type: StudentProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class or student not found' })
  async getStudentProfile(
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
    @Query() query: SemesterQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<StudentProfileResponseDto> {
    return this.studentsService.getStudentProfile(studentId, classId, user.sub, query.semester);
  }

  /**
   * Returns a formal student report aggregating test results, class benchmarks,
   * attendance metrics, and the recommended final grade.
   *
   * Optionally scoped to a single semester via ?semester=A|B.
   * When omitted, the report covers all semesters.
   */
  @Get(':studentId/report')
  @ApiOperation({ summary: 'Generate formal student report with class benchmarks' })
  @ApiParam({ name: 'classId',   description: 'Class ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ status: 200, type: StudentReportResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Class does not belong to this teacher' })
  @ApiResponse({ status: 404, description: 'Class or student not found' })
  async getStudentReport(
    @Param('classId')   classId:   string,
    @Param('studentId') studentId: string,
    @Query() query:     SemesterQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<StudentReportResponseDto> {
    return this.studentsService.getStudentReport(
      studentId,
      classId,
      user.sub,
      query.semester,
    );
  }

  /**
   * Records a new talmidaut assessment (השתתפות + לבוש + התנהגות) for a student
   * and recomputes the recommended final grade.
   * Only accessible by the teacher who owns the class.
   */
  @Post(':studentId/talmidaut')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a talmidaut record and recalculate final grade' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ status: 201, description: 'Record saved and final grade recalculated' })
  @ApiResponse({ status: 400, description: 'Invalid input — scores must be 0–100' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class or student not found' })
  async addTalmidautRecord(
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
    @Body() dto: CreateTalmidautDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<FinalGradeResult> {
    return this.studentsService.addTalmidautRecord(studentId, classId, dto, user.sub);
  }

  /**
   * Soft-deletes a student from the class (PPA right to deletion).
   * Sets Student.deletedAt — the student is excluded from all future queries
   * but historical records (test results, audit logs) are preserved.
   */
  @Delete(':studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove (soft-delete) a student from a class' })
  @ApiParam({ name: 'classId',   description: 'Class ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  @ApiResponse({ status: 204, description: 'Student removed' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Class does not belong to this teacher' })
  @ApiResponse({ status: 404, description: 'Class or student not found' })
  async removeStudentFromClass(
    @Param('classId')   classId:   string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.studentsService.removeStudentFromClass(studentId, classId, user.sub);
  }

  /**
   * Bulk-imports students from an uploaded Excel (.xlsx) or CSV file.
   * Parses Hebrew headers from Mashov/Smart School exports.
   * File limit: 5 MB.
   */
  @Post('import')
  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/csv',
      ];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  @ApiOperation({ summary: 'ייבוא רשימת תלמידים מקובץ Excel/CSV' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiResponse({ status: 200, type: Object, description: 'סיכום ייבוא' })
  @ApiResponse({ status: 400, description: 'קובץ לא תקין' })
  @ApiResponse({ status: 401, description: 'לא מחובר' })
  @ApiResponse({ status: 403, description: 'אין גישה לכיתה זו' })
  async importStudents(
    @Param('classId') classId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<ImportResultDto> {
    if (!file) throw new BadRequestException('לא הועלה קובץ');
    return this.studentsService.importFromFile(classId, user.sub, file.buffer, file.mimetype);
  }

  /**
   * Creates a new student and enrolls them in the given class.
   * Throws 409 if the nationalId is already enrolled in this or any other class.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a student to a class (creates by nationalId)' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiResponse({ status: 201, type: StudentResponseDto, description: 'Student created and enrolled' })
  @ApiResponse({ status: 400, description: 'Invalid input or gender-class mismatch' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  @ApiResponse({ status: 409, description: 'Student already enrolled in this or another class' })
  async addStudentToClass(
    @Param('classId') classId: string,
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ student: StudentResponseDto }> {
    const { student } = await this.studentsService.addStudentToClass(classId, dto, user.sub);
    return { student };
  }
}
