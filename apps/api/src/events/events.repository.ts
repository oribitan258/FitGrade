import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEventDto } from './dto/create-event.dto';

interface RawEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: Date;
  location: string | null;
  teacherId: string;
  createdAt: Date;
  updatedAt: Date;
}

const EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  eventDate: true,
  location: true,
  teacherId: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByTeacher(teacherId: string): Promise<RawEvent[]> {
    return this.prisma.event.findMany({
      where: { teacherId },
      orderBy: { eventDate: 'asc' },
      select: EVENT_SELECT,
    });
  }

  async findNextUpcoming(teacherId: string, now: Date): Promise<RawEvent | null> {
    return this.prisma.event.findFirst({
      where: { teacherId, eventDate: { gte: now } },
      orderBy: { eventDate: 'asc' },
      select: EVENT_SELECT,
    });
  }

  async create(teacherId: string, dto: CreateEventDto): Promise<RawEvent> {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        eventDate: new Date(dto.eventDate),
        location: dto.location ?? null,
        teacherId,
      },
      select: EVENT_SELECT,
    });
  }

  async findByIdAndTeacher(id: string, teacherId: string): Promise<RawEvent | null> {
    return this.prisma.event.findFirst({
      where: { id, teacherId },
      select: EVENT_SELECT,
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.event.delete({ where: { id } });
  }
}
