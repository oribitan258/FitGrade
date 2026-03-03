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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassResponseDto } from './dto/class-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /**
   * Returns all classes belonging to the authenticated teacher.
   * Ordered newest-first.
   */
  @Get()
  @ApiOperation({ summary: 'List all classes for the authenticated teacher' })
  @ApiResponse({ status: 200, type: [ClassResponseDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMyClasses(
    @CurrentUser() user: JwtPayload,
  ): Promise<ClassResponseDto[]> {
    return this.classesService.getMyClasses(user.sub);
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
