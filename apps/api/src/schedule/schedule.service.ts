import { Injectable } from '@nestjs/common';
import type { Semester } from '@prisma/client';
import { ScheduleRepository } from './schedule.repository';
import type { TodayScheduleItemDto, ScheduleLessonStatus } from './dto/today-schedule-item.dto';

/** Lesson duration in minutes — used to determine the "now" window. */
const LESSON_DURATION_MINUTES = 45;

@Injectable()
export class ScheduleService {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  /**
   * Returns today's schedule for the teacher with real-time status labels.
   * Status is computed server-side based on the current Israel Standard Time.
   */
  async getTodaySchedule(teacherId: string, semester: Semester = 'A'): Promise<TodayScheduleItemDto[]> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday … 6=Saturday

    const entries = await this.scheduleRepository.findEntriesForDay(teacherId, dayOfWeek, semester);

    const nowMin = now.getHours() * 60 + now.getMinutes();

    let foundNext = false;

    return entries.map((entry) => {
      const [hStr, mStr] = entry.startTime.split(':');
      const lessonStart = parseInt(hStr ?? '0', 10) * 60 + parseInt(mStr ?? '0', 10);
      const lessonEnd = lessonStart + LESSON_DURATION_MINUTES;

      let status: ScheduleLessonStatus;

      if (nowMin >= lessonStart && nowMin < lessonEnd) {
        status = 'now';
      } else if (nowMin < lessonStart) {
        if (!foundNext) {
          foundNext = true;
          status = 'next';
        } else {
          status = 'later';
        }
      } else {
        status = 'past';
      }

      return {
        period: entry.period,
        startTime: entry.startTime,
        classId: entry.classId,
        className: entry.className,
        status,
      };
    });
  }

  async upsertEntry(
    teacherId: string,
    dayOfWeek: number,
    period: number,
    startTime: string,
    classId: string,
    semester: Semester = 'A',
  ): Promise<void> {
    await this.scheduleRepository.upsertEntry(teacherId, dayOfWeek, period, startTime, classId, semester);
  }

  async deleteEntry(
    teacherId: string,
    dayOfWeek: number,
    period: number,
    semester: Semester = 'A',
  ): Promise<void> {
    await this.scheduleRepository.deleteEntry(teacherId, dayOfWeek, period, semester);
  }
}
