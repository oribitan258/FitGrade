import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentResponseDto } from './dto/student-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('students')
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
