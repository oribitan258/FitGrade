import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AiActionLogDto } from './dto/ai-action-log.dto';

/** How many AiActionLog rows to return in the history list. */
const HISTORY_PAGE_SIZE = 50;

@Injectable()
export class CopilotRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the most recent AI action logs for the given teacher,
   * ordered newest-first, capped at HISTORY_PAGE_SIZE.
   */
  async findAiActionLogs(teacherId: string): Promise<AiActionLogDto[]> {
    const logs = await this.prisma.aiActionLog.findMany({
      where: { teacherId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_PAGE_SIZE,
      select: {
        id: true,
        toolName: true,
        summary: true,
        params: true,
        revertedAt: true,
        createdAt: true,
      },
    });

    return logs.map((log) => ({
      id: log.id,
      toolName: log.toolName,
      summary: log.summary,
      params: log.params as Record<string, unknown>,
      revertedAt: log.revertedAt?.toISOString() ?? null,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  /**
   * Returns the class name for context enrichment if the class belongs to the teacher.
   * Returns null if the class doesn't exist or doesn't belong to the teacher.
   */
  async findClassNameForTeacher(classId: string, teacherId: string): Promise<string | null> {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: { name: true },
    });
    return cls?.name ?? null;
  }

  /**
   * Returns the teacher's display name, or null if the user record is not found.
   */
  async findTeacherName(teacherId: string): Promise<string | null> {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { name: true },
    });
    return teacher?.name ?? null;
  }
}
