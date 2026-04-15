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
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { SemesterQueryDto } from '../classes/dto/semester-query.dto';
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
   * Returns all students enrolled in the given class.
   * Only accessible by the teacher who owns the class.
   */
  @Get()
  @ApiOperation({ summary: 'List students enrolled in a class' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiResponse({ status: 200, type: [StudentResponseDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  async getStudentsByClass(
    @Param('classId') classId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StudentResponseDto[]> {
    return this.studentsService.getStudentsByClass(classId, user.sub);
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
   * Creates a new student and enrolls them in the given class.
   * studentCode must be unique within the class.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a student to a class' })
  @ApiParam({ name: 'classId', description: 'Class ID' })
  @ApiResponse({ status: 201, type: StudentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  @ApiResponse({ status: 409, description: 'Student code already taken in this class' })
  async addStudentToClass(
    @Param('classId') classId: string,
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<StudentResponseDto> {
    return this.studentsService.addStudentToClass(classId, dto, user.sub);
  }
}
