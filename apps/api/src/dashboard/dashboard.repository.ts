import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Grade threshold below which a student is flagged as "below norm". */
export const PASS_GRADE_THRESHOLD = 57;

/** Number of recent sessions to include in the dashboard response. */
const RECENT_SESSIONS_LIMIT = 5;

export interface RawResult {
  sessionClassId: string;
  studentId: string;
  calculatedGrade: number;
}

export interface RawAttendance {
  classId: string;
  isPresent: boolean;
}

export interface RawSession {
  sessionId: string;
  classId: string;
  className: string;
  testNameHe: string;
  conductedAt: Date;
}

export interface ClassMeta {
  id: string;
  studentCount: number;
  sessionCount: number;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all class IDs for the teacher with enrollment counts and session counts.
   */
  async findTeacherClassMeta(teacherId: string): Promise<ClassMeta[]> {
    const classes = await this.prisma.class.findMany({
      where: { teacherId },
      select: {
        id: true,
        _count: {
          select: {
            enrollments: true,
            testSessions: true,
          },
        },
      },
    });
    return classes.map((c) => ({
      id: c.id,
      studentCount: c._count.enrollments,
      sessionCount: c._count.testSessions,
    }));
  }

  /**
   * Returns all test results for the teacher's classes.
   * Used for in-memory aggregation of fitness stats.
   */
  async findResultsForTeacher(classIds: string[]): Promise<RawResult[]> {
    if (classIds.length === 0) return [];
    const results = await this.prisma.testResult.findMany({
      where: { session: { classId: { in: classIds } } },
      select: {
        calculatedGrade: true,
        studentId: true,
        session: { select: { classId: true } },
      },
    });
    return results.map((r) => ({
      sessionClassId: r.session.classId,
      studentId: r.studentId,
      calculatedGrade: r.calculatedGrade ?? 0,
    }));
  }

  /**
   * Returns all attendance records for the teacher's classes.
   * Used for in-memory aggregation of attendance stats.
   */
  async findAttendanceForTeacher(classIds: string[]): Promise<RawAttendance[]> {
    if (classIds.length === 0) return [];
    const records = await this.prisma.attendanceRecord.findMany({
      where: { classId: { in: classIds } },
      select: { classId: true, status: true },
    });
    return records.map((r) => ({
      classId: r.classId,
      isPresent: r.status === 'PRESENT',
    }));
  }

  /**
   * Returns the N most recent test sessions across all teacher classes,
   * ordered newest-first.
   */
  async findRecentSessions(classIds: string[]): Promise<RawSession[]> {
    if (classIds.length === 0) return [];
    const sessions = await this.prisma.testSession.findMany({
      where: { classId: { in: classIds } },
      orderBy: { conductedAt: 'desc' },
      take: RECENT_SESSIONS_LIMIT,
      select: {
        id: true,
        classId: true,
        conductedAt: true,
        class: { select: { name: true } },
        testType: { select: { nameHe: true } },
      },
    });
    return sessions.map((s) => ({
      sessionId: s.id,
      classId: s.classId,
      className: s.class.name,
      testNameHe: s.testType.nameHe,
      conductedAt: s.conductedAt,
    }));
  }
}
