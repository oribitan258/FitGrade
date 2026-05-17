import { Injectable } from '@nestjs/common';
import type { Semester } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RawScheduleEntry {
  period: number;
  startTime: string;
  classId: string;
  className: string;
}

@Injectable()
export class ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEntriesForDay(
    teacherId: string,
    dayOfWeek: number,
    semester: Semester = 'A',
  ): Promise<RawScheduleEntry[]> {
    const entries = await this.prisma.scheduleEntry.findMany({
      where: { teacherId, dayOfWeek, semester },
      orderBy: { period: 'asc' },
      select: {
        period: true,
        startTime: true,
        classId: true,
        class: { select: { name: true } },
      },
    });

    return entries.map((e) => ({
      period: e.period,
      startTime: e.startTime,
      classId: e.classId,
      className: e.class.name,
    }));
  }

  async upsertEntry(
    teacherId: string,
    dayOfWeek: number,
    period: number,
    startTime: string,
    classId: string,
    semester: Semester = 'A',
  ): Promise<void> {
    await this.prisma.scheduleEntry.upsert({
      where: { teacherId_dayOfWeek_period_semester: { teacherId, dayOfWeek, period, semester } },
      update: { classId, startTime },
      create: { teacherId, dayOfWeek, period, startTime, classId, semester },
    });
  }

  async deleteEntry(
    teacherId: string,
    dayOfWeek: number,
    period: number,
    semester: Semester = 'A',
  ): Promise<void> {
    await this.prisma.scheduleEntry.deleteMany({
      where: { teacherId, dayOfWeek, period, semester },
    });
  }
}
