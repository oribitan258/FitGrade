import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RawScheduleEntry {
  period: number;
  startTime: string;
  classId: string;
  className: string;
}

/** Local type alias for the scheduleEntry delegate — available after `prisma generate`. */
type ScheduleEntryDelegate = PrismaClient['scheduleEntry'];

@Injectable()
export class ScheduleRepository {
  /** scheduleEntry delegate — cast via unknown until Prisma client is regenerated. */
  private get db(): ScheduleEntryDelegate {
    return (this.prisma as unknown as { scheduleEntry: ScheduleEntryDelegate }).scheduleEntry;
  }

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all schedule entries for the teacher on a given day of week,
   * ordered by period ascending. Joins with Class to get the class name.
   * Run `pnpm exec prisma migrate dev` to activate the ScheduleEntry model.
   */
  async findEntriesForDay(teacherId: string, dayOfWeek: number): Promise<RawScheduleEntry[]> {
    const entries = await this.db.findMany({
      where: { teacherId, dayOfWeek },
      orderBy: { period: 'asc' },
      select: {
        period: true,
        startTime: true,
        classId: true,
        class: { select: { name: true } },
      },
    });

    return entries.map((e: { period: number; startTime: string; classId: string; class: { name: string } }) => ({
      period: e.period,
      startTime: e.startTime,
      classId: e.classId,
      className: e.class.name,
    }));
  }

  /**
   * Upserts a single schedule slot (teacher + dayOfWeek + period is unique).
   * Creates a new entry or replaces the classId/startTime of an existing one.
   */
  async upsertEntry(
    teacherId: string,
    dayOfWeek: number,
    period: number,
    startTime: string,
    classId: string,
  ): Promise<void> {
    await this.db.upsert({
      where: { teacherId_dayOfWeek_period: { teacherId, dayOfWeek, period } },
      update: { classId, startTime },
      create: { teacherId, dayOfWeek, period, startTime, classId },
    });
  }

  /**
   * Deletes a single schedule slot. No-ops if the slot was empty.
   */
  async deleteEntry(teacherId: string, dayOfWeek: number, period: number): Promise<void> {
    await this.db.deleteMany({
      where: { teacherId, dayOfWeek, period },
    });
  }
}
