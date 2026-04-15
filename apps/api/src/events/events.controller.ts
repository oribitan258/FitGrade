import {
  Body,
  Controller,
  Delete,
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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@ApiTags('events')
@Roles('TEACHER')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // IMPORTANT: /events/upcoming must be declared before /events/:id
  // so NestJS matches the literal segment before the param segment.
  @Get('upcoming')
  @ApiOperation({ summary: 'Return the next upcoming event for the teacher, or null' })
  @ApiResponse({ status: 200, type: EventResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getUpcoming(
    @CurrentUser() user: JwtPayload,
  ): Promise<EventResponseDto | null> {
    return this.eventsService.getUpcoming(user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all events for the authenticated teacher, ordered by date' })
  @ApiResponse({ status: 200, type: [EventResponseDto] })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async listAll(@CurrentUser() user: JwtPayload): Promise<EventResponseDto[]> {
    return this.eventsService.listAll(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, type: EventResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<EventResponseDto> {
    return this.eventsService.create(user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an event (must belong to the authenticated teacher)' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.eventsService.remove(id, user.sub);
  }
}
