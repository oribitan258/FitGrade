import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventsRepository } from './events.repository';
import type { CreateEventDto } from './dto/create-event.dto';
import type { EventResponseDto } from './dto/event-response.dto';

function mapToDto(raw: {
  id: string;
  title: string;
  description: string | null;
  eventDate: Date;
  location: string | null;
  teacherId: string;
  createdAt: Date;
  updatedAt: Date;
}): EventResponseDto {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    eventDate: raw.eventDate.toISOString(),
    location: raw.location,
    teacherId: raw.teacherId,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly eventsRepository: EventsRepository) {}

  async listAll(teacherId: string): Promise<EventResponseDto[]> {
    const events = await this.eventsRepository.findAllByTeacher(teacherId);
    return events.map(mapToDto);
  }

  async getUpcoming(teacherId: string): Promise<EventResponseDto | null> {
    const event = await this.eventsRepository.findNextUpcoming(teacherId, new Date());
    return event ? mapToDto(event) : null;
  }

  async create(teacherId: string, dto: CreateEventDto): Promise<EventResponseDto> {
    const event = await this.eventsRepository.create(teacherId, dto);
    this.logger.log(`Event created: ${event.id} by teacher ${teacherId}`);
    return mapToDto(event);
  }

  async remove(id: string, teacherId: string): Promise<void> {
    const event = await this.eventsRepository.findByIdAndTeacher(id, teacherId);
    if (!event) {
      throw new NotFoundException(`אירוע עם מזהה ${id} לא נמצא`);
    }
    await this.eventsRepository.deleteById(id);
    this.logger.log(`Event deleted: ${id} by teacher ${teacherId}`);
  }
}
