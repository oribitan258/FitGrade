import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TestTypeResponseDto } from './dto/test-type-response.dto';
import type { SessionResponseDto } from './dto/session-response.dto';
import type { ResultResponseDto } from './dto/result-response.dto';
import type { SessionDetailResponseDto } from './dto/session-detail-response.dto';
import type { TestTypeNormsResponseDto } from './dto/norm-band-response.dto';

const TEST_TYPE_SELECT = {
  id: true,
  nameHe: true,
  descriptionHe: true,
  inputType: true,
  unit: true,
  isGlobal: true,
  higherIsBetter: true,
  category: true,
  minGrade: true,
  maxGrade: true,
  createdAt: true,
} as const;

const SESSION_SELECT = {
  id: true,
  classId: true,
  testTypeId: true,
  semester: true,
  conductedAt: true,
  notes: true,
  isStopwatch: true,
  startedAt: true,
  completedAt: true,
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
      where: { id: classId, deletedAt: null },
      select: { id: true, teacherId: true },
    });
    if (cls === null) {
      throw new NotFoundException(`כיתה ${classId} לא נמצאה`);
    }
    if (cls.teacherId !== teacherId) {
      throw new ForbiddenException();
    }
  }

  /**
   * Verifies the student is actively enrolled in the given class.
   * Throws BadRequestException if no enrollment record exists. (LOGIC-003)
   *
   * Prevents a teacher from submitting a result for a student who belongs to
   * a different class — even if the teacher owns the session and the student
   * exists in the system.
   */
  async verifyStudentEnrolled(studentId: string, classId: string): Promise<void> {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: { studentId, classId },
      select: { id: true },
    });
    if (enrollment === null) {
      throw new BadRequestException('התלמיד אינו רשום לכיתה זו');
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
    conductedAt?: Date,
    semester?: import('@prisma/client').Semester,
  ): Promise<SessionResponseDto> {
    return this.prisma.testSession.create({
      data: {
        classId,
        testTypeId,
        notes,
        isStopwatch,
        ...(conductedAt !== undefined ? { conductedAt } : {}),
        ...(semester !== undefined ? { semester } : {}),
      },
      select: SESSION_SELECT,
    });
  }

  /**
   * Finds a session and verifies it belongs to the teacher's class.
   * Returns the testTypeId needed for grade calculation.
   *
   * Distinguishes:
   *   - NotFoundException — session id does not exist at all
   *   - ForbiddenException — session exists but is owned by a different teacher
   *
   * Two-step lookup avoids the information-disclosure gap where a combined
   * `findFirst({ where: { id, class: { teacherId } } })` returns null for both
   * cases, masking cross-teacher access as a generic 404. (SEC-003)
   */
  async findSessionWithOwnership(
    sessionId: string,
    teacherId: string,
  ): Promise<{
    testTypeId: string;
    conductedAt: Date;
    inputType: import('@prisma/client').FitnessInputType;
    testNameHe: string;
    classId: string;
    isStopwatch: boolean;
    startedAt: Date | null;
  }> {
    const session = await this.prisma.testSession.findUnique({
      where: { id: sessionId },
      select: {
        classId: true,
        testTypeId: true,
        conductedAt: true,
        isStopwatch: true,
        startedAt: true,
        class: { select: { teacherId: true } },
        testType: { select: { inputType: true, nameHe: true } },
      },
    });
    if (session === null) {
      throw new NotFoundException(`סשן ${sessionId} לא נמצא`);
    }
    if (session.class.teacherId !== teacherId) {
      throw new ForbiddenException();
    }
    return {
      classId: session.classId,
      testTypeId: session.testTypeId,
      conductedAt: session.conductedAt,
      inputType: session.testType.inputType,
      testNameHe: session.testType.nameHe,
      isStopwatch: session.isStopwatch,
      startedAt: session.startedAt,
    };
  }

  /**
   * Returns full session details — including test-type metadata, enrolled students,
   * and all results recorded so far — for the live-session UI.
   *
   * Distinguishes 404 (session does not exist) from 403 (session belongs to
   * a different teacher). See findSessionWithOwnership for the same pattern. (SEC-003)
   */
  async findSessionWithStudents(
    sessionId: string,
    teacherId: string,
  ): Promise<SessionDetailResponseDto> {
    const session = await this.prisma.testSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        classId: true,
        testTypeId: true,
        conductedAt: true,
        notes: true,
        isStopwatch: true,
        startedAt: true,
        completedAt: true,
        testType: {
          select: { nameHe: true, unit: true, inputType: true },
        },
        class: {
          select: {
            teacherId: true,
            enrollments: {
              select: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    studentCode: true,
                    nationalId: true,
                  },
                },
              },
              orderBy: { student: { lastName: 'asc' } },
            },
          },
        },
        results: {
          select: {
            id: true,
            studentId: true,
            rawValue: true,
            calculatedGrade: true,
            gradeOverride: true,
            recordedAt: true,
          },
          orderBy: { recordedAt: 'asc' },
        },
      },
    });

    if (session === null) {
      throw new NotFoundException(`סשן ${sessionId} לא נמצא`);
    }
    if (session.class.teacherId !== teacherId) {
      throw new ForbiddenException();
    }

    return {
      id: session.id,
      classId: session.classId,
      testTypeId: session.testTypeId,
      testNameHe: session.testType.nameHe,
      testUnit: session.testType.unit,
      testInputType: session.testType.inputType,
      conductedAt: session.conductedAt,
      isStopwatch: session.isStopwatch,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      students: session.class.enrollments.map((e) => e.student),
      results: session.results.map((r) => ({
        resultId: r.id,
        studentId: r.studentId,
        rawValue: Number(r.rawValue ?? 0),
        calculatedGrade: r.calculatedGrade ?? 0,
        gradeOverride: r.gradeOverride,
        recordedAt: r.recordedAt,
      })),
    };
  }

  /**
   * Sets startedAt to the current server time, enabling accurate elapsed-time
   * calculation for stopwatch sessions.
   */
  async startSession(sessionId: string): Promise<SessionResponseDto> {
    return this.prisma.testSession.update({
      where: { id: sessionId },
      data: { startedAt: new Date() },
      select: SESSION_SELECT,
    });
  }

  /**
   * Sets completedAt to the current server time, marking the session as closed.
   */
  async completeSession(sessionId: string): Promise<SessionResponseDto> {
    return this.prisma.testSession.update({
      where: { id: sessionId },
      data: { completedAt: new Date() },
      select: SESSION_SELECT,
    });
  }

  /**
   * Deletes a test result identified by (sessionId, studentId).
   * Throws NotFoundException if no such result exists.
   * Throws UnprocessableEntityException if the result is older than undoWindowMs.
   */
  async deleteResult(
    sessionId: string,
    studentId: string,
    undoWindowMs: number,
  ): Promise<void> {
    const result = await this.prisma.testResult.findFirst({
      where: { sessionId, studentId },
      select: { id: true, recordedAt: true },
    });
    if (result === null) {
      throw new NotFoundException(
        `תוצאה לתלמיד ${studentId} בסשן ${sessionId} לא נמצאה`,
      );
    }
    if (Date.now() - result.recordedAt.getTime() > undoWindowMs) {
      throw new UnprocessableEntityException(
        'לא ניתן לבטל תוצאה לאחר 30 שניות מרישומה',
      );
    }
    await this.prisma.testResult.delete({ where: { id: result.id } });
  }

  /**
   * Returns all NormTable bands for the given test type, ordered by
   * minAge → gender → score descending. The caller filters client-side
   * by gender + age group as needed.
   * Throws NotFoundException if the test type doesn't exist.
   */
  async findNormBandsForTestType(testTypeId: string): Promise<TestTypeNormsResponseDto> {
    const testType = await this.prisma.fitnessTestType.findUniqueOrThrow({
      where: { id: testTypeId },
      select: {
        id: true,
        nameHe: true,
        unit: true,
        inputType: true,
        higherIsBetter: true,
        normTables: {
          select: {
            gender: true,
            gradeLevel: true,
            score: true,
            minValue: true,
            maxValue: true,
          },
          orderBy: [
            { gradeLevel: 'asc' },
            { gender: 'asc' },
            { score: 'desc' },
          ],
        },
      },
    });

    return {
      testTypeId: testType.id,
      nameHe: testType.nameHe,
      unit: testType.unit,
      inputType: testType.inputType,
      higherIsBetter: testType.higherIsBetter,
      bands: testType.normTables.map((b) => ({
        gender: b.gender,
        gradeLevel: b.gradeLevel,
        score: b.score,
        minValue: Number(b.minValue),
        maxValue: Number(b.maxValue),
      })),
    };
  }

  /**
   * Updates gradeOverride and overrideReason on an existing TestResult.
   *
   * SECURITY: the (resultId, sessionId) pair is enforced atomically via
   * `updateMany`. Without this, a teacher who owns Session A could pass the
   * resultId of a record belonging to Session B (a different teacher's session)
   * and overwrite it — the session-level ownership check upstream would have
   * passed because it only validated Session A. (SEC-001)
   *
   * `updateMany` returns `count: 0` when no row matches the combined filter,
   * which we translate to NotFoundException (we never reveal that the
   * resultId exists elsewhere — that would be an information disclosure).
   *
   * The trailing `findUniqueOrThrow` is a primary-key lookup and runs only
   * when the update succeeded, so it cannot throw under normal operation.
   */
  async overrideResultGrade(
    resultId: string,
    sessionId: string,
    gradeOverride: number,
    overrideReason: string,
  ): Promise<ResultResponseDto> {
    const updated = await this.prisma.testResult.updateMany({
      where: { id: resultId, sessionId },
      data: { gradeOverride, overrideReason },
    });
    if (updated.count === 0) {
      throw new NotFoundException(
        `תוצאה ${resultId} לא נמצאה בסשן ${sessionId}`,
      );
    }
    const result = await this.prisma.testResult.findUniqueOrThrow({
      where: { id: resultId },
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
