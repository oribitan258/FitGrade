import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TestTypeResponseDto } from './dto/test-type-response.dto';
import type { SessionResponseDto } from './dto/session-response.dto';
import type { ResultResponseDto } from './dto/result-response.dto';

const TEST_TYPE_SELECT = {
  id: true,
  nameHe: true,
  descriptionHe: true,
  inputType: true,
  unit: true,
  isGlobal: true,
  createdAt: true,
} as const;

const SESSION_SELECT = {
  id: true,
  classId: true,
  testTypeId: true,
  conductedAt: true,
  notes: true,
  isStopwatch: true,
  startedAt: true,
} as const;

const RESULT_SELECT = {
  id: true,
  sessionId: true,
  studentId: true,
  rawValue: true,
  calculatedGrade: true,
  gradeOverride: true,
  recordedAt: true,
} as const;

@Injectable()
export class TestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns all system-seeded FitnessTestTypes ordered by Hebrew name. */
  async findAllTestTypes(): Promise<TestTypeResponseDto[]> {
    return this.prisma.fitnessTestType.findMany({
      select: TEST_TYPE_SELECT,
      orderBy: { nameHe: 'asc' },
    });
  }

  /**
   * Verifies the class exists and belongs to the given teacher.
   * Throws NotFoundException if not found.
   */
  async verifyClassOwnership(classId: string, teacherId: string): Promise<void> {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, teacherId },
      select: { id: true },
    });
    if (cls === null) {
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
  }

  /**
   * Verifies the test type exists.
   * Throws NotFoundException if not found.
   */
  async verifyTestTypeExists(testTypeId: string): Promise<void> {
    const testType = await this.prisma.fitnessTestType.findUnique({
      where: { id: testTypeId },
      select: { id: true },
    });
    if (testType === null) {
      throw new NotFoundException(`סוג בדיקה ${testTypeId} לא נמצא`);
    }
  }

  /** Creates a new TestSession for the given class. */
  async createSession(
    classId: string,
    testTypeId: string,
    notes: string | undefined,
    isStopwatch: boolean,
  ): Promise<SessionResponseDto> {
    return this.prisma.testSession.create({
      data: { classId, testTypeId, notes, isStopwatch },
      select: SESSION_SELECT,
    });
  }

  /**
   * Finds a session and verifies it belongs to the teacher's class.
   * Returns the testTypeId needed for grade calculation.
   * Throws NotFoundException if the session doesn't exist or isn't accessible by this teacher.
   */
  async findSessionWithOwnership(
    sessionId: string,
    teacherId: string,
  ): Promise<{ testTypeId: string }> {
    const session = await this.prisma.testSession.findFirst({
      where: { id: sessionId, class: { teacherId } },
      select: { testTypeId: true },
    });
    if (session === null) {
      throw new NotFoundException(`סשן ${sessionId} לא נמצא`);
    }
    return session;
  }

  /**
   * Creates a TestResult for a student in a session with the pre-calculated grade.
   * Throws ConflictException if a result already exists for this student+session.
   */
  async createResult(
    sessionId: string,
    studentId: string,
    rawValue: number,
    calculatedGrade: number,
  ): Promise<ResultResponseDto> {
    try {
      const result = await this.prisma.testResult.create({
        data: {
          sessionId,
          studentId,
          rawValue: new Prisma.Decimal(rawValue),
          calculatedGrade,
        },
        select: RESULT_SELECT,
      });
      return {
        id: result.id,
        sessionId: result.sessionId,
        studentId: result.studentId,
        rawValue: Number(result.rawValue ?? 0),
        calculatedGrade: result.calculatedGrade ?? 0,
        gradeOverride: result.gradeOverride,
        recordedAt: result.recordedAt,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('תוצאה לתלמיד זה כבר קיימת בסשן זה');
      }
      throw e;
    }
  }
}
