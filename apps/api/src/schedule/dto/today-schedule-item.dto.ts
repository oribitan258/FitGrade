import { ApiProperty } from '@nestjs/swagger';

export type ScheduleLessonStatus = 'now' | 'next' | 'later' | 'past';

export class TodayScheduleItemDto {
  @ApiProperty({ description: '0-based period index' })
  declare period: number;

  @ApiProperty({ description: 'Period start time in HH:MM format', example: '08:15' })
  declare startTime: string;

  @ApiProperty({ description: 'Class ID' })
  declare classId: string;

  @ApiProperty({ description: 'Class display name' })
  declare className: string;

  @ApiProperty({ enum: ['now', 'next', 'later', 'past'], description: 'Lesson status relative to current server time' })
  declare status: ScheduleLessonStatus;
}
