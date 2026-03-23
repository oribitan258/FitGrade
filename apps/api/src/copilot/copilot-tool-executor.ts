import {
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import type {
  AttendancePendingPreview,
  ExercisePlanPendingPreview,
  PendingActionPreview,
  TestResultPendingPreview,
} from '@fitgrade/types';
import { PrismaService } from '../prisma/prisma.service';
import { ClassesService } from '../classes/classes.service';
import { StudentsService } from '../students/students.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ReportsService } from '../reports/reports.service';
import { AttendanceService } from '../attendance/attendance.service';
import { TestsService } from '../tests/tests.service';
import type { ToolName } from './copilot-tools';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ToolExecutionResult {
  success: boolean;
  data: unknown;
}

// Snapshot shapes captured before each WRITE tool executes
interface AttendanceSnapshot {
  records: { studentId: string; status: string }[];
}

interface ExercisePlanSnapshot {
  existingPlanData: string | null;
}

interface TestResultSnapshot {
  existingResultId: string | null;
  existingRawValue: number | null;
}

type ToolSnapshot = AttendanceSnapshot | ExercisePlanSnapshot | TestResultSnapshot;

// ─────────────────────────────────────────────
// Executor
// ─────────────────────────────────────────────

/**
 * Executes Copilot tool calls by delegating to existing domain services.
 *
 * READ tools:   execute immediately and return data for Claude to summarise.
 * WRITE tools:  capture a pre-write snapshot, execute the write, and persist
 *               an AiActionLog row so the teacher can revert the action later.
 *
 * Architecture rule: all Prisma calls go through existing service/repository
 * layers. Direct prisma.* access is used only for AiActionLog itself (a
 * copilot-owned model with no dedicated repository yet) and for lookup queries
 * that no existing service exposes.
 */
@Injectable()
export class CopilotToolExecutor {
  private readonly logger = new Logger(CopilotToolExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly classesService: ClassesService,
    private readonly studentsService: StudentsService,
    private readonly dashboardService: DashboardService,
    private readonly reportsService: ReportsService,
    private readonly attendanceService: AttendanceService,
    private readonly testsService: TestsService,
  ) {}

  // ── READ TOOLS ────────────────────────────────────────────────────────────

  async executeRead(
    toolName: ToolName,
    params: Record<string, unknown>,
    teacherId: string,
  ): Promise<ToolExecutionResult> {
    try {
      const data = await this.dispatchRead(toolName, params, teacherId);
      return { success: true, data };
    } catch (err) {
      this.logger.error(`READ tool ${toolName} failed`, err);
      return {
        success: false,
        data: `Tool ${toolName} failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  private async dispatchRead(
    toolName: ToolName,
    params: Record<string, unknown>,
    teacherId: string,
  ): Promise<unknown> {
    switch (toolName) {
      case 'get_class_summary':
        return this.classesService.getClassDetails(
          params['classId'] as string,
          teacherId,
        );

      case 'get_student_profile':
        return this.studentsService.getStudentProfile(
          params['studentId'] as string,
          params['classId'] as string,
          teacherId,
        );

      case 'get_below_norm_students':
        return this.dashboardService.getBelowNormDetails(teacherId);

      case 'get_missing_results':
        return this.dashboardService.getMissingResults(teacherId);

      case 'get_class_report':
        return this.reportsService.getClassReport(
          params['classId'] as string,
          teacherId,
        );

      default:
        throw new Error(`Unknown READ tool: ${toolName}`);
    }
  }

  // ── BUILD PREVIEW ─────────────────────────────────────────────────────────

  /**
   * Builds a structured PendingActionPreview for the HITL card without executing
   * any writes. Called before the pending action is stored.
   */
  buildPreview(
    toolName: ToolName,
    params: Record<string, unknown>,
  ): PendingActionPreview {
    switch (toolName) {
      case 'save_attendance': {
        const records = params['records'] as Array<{
          studentId: string;
          studentName: string;
          status: string;
        }>;
        const preview: AttendancePendingPreview = {
          toolName: 'save_attendance',
          className: params['className'] as string ?? '',
          date: params['date'] as string,
          rows: records.map((r) => ({
            studentName: r.studentName,
            statusHe: this.attendanceStatusToHebrew(r.status),
          })),
        };
        return preview;
      }

      case 'generate_exercise_plan': {
        const preview: ExercisePlanPendingPreview = {
          toolName: 'generate_exercise_plan',
          studentName: params['studentName'] as string,
          trackName: params['trackName'] as string,
          week1Focus: params['week1Focus'] as string,
        };
        return preview;
      }

      case 'submit_test_result': {
        const preview: TestResultPendingPreview = {
          toolName: 'submit_test_result',
          studentName: params['studentName'] as string,
          testTypeNameHe: params['testTypeNameHe'] as string,
          rawValue: params['rawValueFormatted'] as string,
        };
        return preview;
      }

      default:
        throw new Error(`buildPreview called for non-WRITE tool: ${toolName}`);
    }
  }

  // ── WRITE TOOLS — EXECUTE ─────────────────────────────────────────────────

  /**
   * Executes a confirmed WRITE tool:
   *  1. Captures a pre-write snapshot.
   *  2. Executes the write.
   *  3. Persists an AiActionLog row with the snapshot for future rollback.
   * Returns the AiActionLog id.
   */
  async executeWrite(
    toolName: ToolName,
    params: Record<string, unknown>,
    teacherId: string,
  ): Promise<string> {
    const snapshot = await this.captureSnapshot(toolName, params, teacherId);
    await this.dispatchWrite(toolName, params, teacherId);
    const summary = this.generateSummary(toolName, params);

    const log = await this.prisma.aiActionLog.create({
      data: {
        teacherId,
        toolName,
        summary,
        params: params as object,
        snapshot: snapshot as object,
      },
    });

    this.logger.log(`AI write executed: tool=${toolName} logId=${log.id} teacher=${teacherId}`);
    return log.id;
  }

  private async captureSnapshot(
    toolName: ToolName,
    params: Record<string, unknown>,
    teacherId: string,
  ): Promise<ToolSnapshot> {
    switch (toolName) {
      case 'save_attendance': {
        const classId = params['classId'] as string;
        const date = params['date'] as string;
        const existing = await this.attendanceService.getAttendance(
          classId,
          date,
          teacherId,
          false,
        );
        return {
          records: existing.map((r) => ({
            studentId: r.studentId,
            status: r.status,
          })),
        };
      }

      case 'generate_exercise_plan': {
        // ExercisePlan model not yet in schema — stub snapshot
        return { existingPlanData: null };
      }

      case 'submit_test_result': {
        const sessionId = params['sessionId'] as string;
        const studentId = params['studentId'] as string;
        const existing = await this.prisma.testResult.findUnique({
          where: { sessionId_studentId: { sessionId, studentId } },
          select: { id: true, rawValue: true },
        });
        return {
          existingResultId: existing?.id ?? null,
          existingRawValue: existing?.rawValue ? Number(existing.rawValue) : null,
        };
      }

      default:
        throw new Error(`captureSnapshot: unknown WRITE tool ${toolName}`);
    }
  }

  private async dispatchWrite(
    toolName: ToolName,
    params: Record<string, unknown>,
    teacherId: string,
  ): Promise<void> {
    switch (toolName) {
      case 'save_attendance': {
        const classId = params['classId'] as string;
        const date = params['date'] as string;
        const records = params['records'] as Array<{
          studentId: string;
          status: string;
          notes?: string;
          exemptionReason?: string;
        }>;
        await this.attendanceService.saveAttendance(
          classId,
          {
            date,
            records: records.map((r) => ({
              studentId: r.studentId,
              status: r.status as AttendanceStatus,
              notes: r.notes,
              exemptionReason: r.exemptionReason,
            })),
          },
          teacherId,
        );
        break;
      }

      case 'generate_exercise_plan': {
        // ExercisePlan model not yet in schema.
        // The plan data is captured in the AiActionLog.params field.
        // TODO: persist to ExercisePlan table once schema migration is added.
        this.logger.log(
          `Exercise plan generated for student=${params['studentId'] as string} (persisted in AiActionLog only)`,
        );
        break;
      }

      case 'submit_test_result': {
        const sessionId = params['sessionId'] as string;
        const studentId = params['studentId'] as string;
        const rawValue = params['rawValue'] as number;

        // If a result already exists for this student in this session, delete it first.
        const existing = await this.prisma.testResult.findUnique({
          where: { sessionId_studentId: { sessionId, studentId } },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.testResult.delete({ where: { id: existing.id } });
        }

        await this.testsService.submitResult(
          sessionId,
          { studentId, rawValue },
          teacherId,
        );
        break;
      }

      default:
        throw new Error(`dispatchWrite: unknown WRITE tool ${toolName}`);
    }
  }

  // ── WRITE TOOLS — REVERT ──────────────────────────────────────────────────

  /**
   * Reverts a previously executed WRITE tool action.
   * Validates ownership and that the action has not already been reverted.
   * Sets revertedAt on the AiActionLog row.
   */
  async revertAction(logId: string, teacherId: string): Promise<void> {
    const log = await this.prisma.aiActionLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      throw new NotFoundException(`פעולה ${logId} לא נמצאה`);
    }
    if (log.teacherId !== teacherId) {
      throw new ForbiddenException();
    }
    if (log.revertedAt !== null) {
      throw new GoneException('הפעולה כבר שוחזרה');
    }

    await this.dispatchRevert(
      log.toolName as ToolName,
      log.params as Record<string, unknown>,
      log.snapshot as Record<string, unknown>,
      teacherId,
    );

    await this.prisma.aiActionLog.update({
      where: { id: logId },
      data: { revertedAt: new Date() },
    });

    this.logger.log(`AI action reverted: logId=${logId} tool=${log.toolName} teacher=${teacherId}`);
  }

  private async dispatchRevert(
    toolName: ToolName,
    params: Record<string, unknown>,
    snapshot: Record<string, unknown>,
    teacherId: string,
  ): Promise<void> {
    switch (toolName) {
      case 'save_attendance': {
        const classId = params['classId'] as string;
        const date = params['date'] as string;
        const snap = snapshot as unknown as AttendanceSnapshot;

        if (snap.records.length === 0) {
          // No attendance existed before — delete all records for this class/date.
          await this.prisma.attendanceRecord.deleteMany({
            where: { classId, date: new Date(date) },
          });
        } else {
          // Restore each student's previous status.
          await this.attendanceService.saveAttendance(
            classId,
            {
              date,
              records: snap.records.map((r) => ({
                studentId: r.studentId,
                status: r.status as AttendanceStatus,
              })),
            },
            teacherId,
          );
        }
        break;
      }

      case 'generate_exercise_plan': {
        // Stub: no DB table to roll back yet.
        this.logger.log(
          `Exercise plan revert stub called for student=${params['studentId'] as string}`,
        );
        break;
      }

      case 'submit_test_result': {
        const snap = snapshot as unknown as TestResultSnapshot;
        const sessionId = params['sessionId'] as string;
        const studentId = params['studentId'] as string;

        // Delete the AI-submitted result.
        await this.prisma.testResult.deleteMany({
          where: { sessionId, studentId },
        });

        // If a previous result existed, restore it (re-submit the original raw value).
        if (snap.existingRawValue !== null) {
          await this.testsService.submitResult(
            sessionId,
            { studentId, rawValue: snap.existingRawValue },
            teacherId,
          );
        }
        break;
      }

      default:
        throw new Error(`dispatchRevert: unknown WRITE tool ${toolName}`);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private generateSummary(toolName: ToolName, params: Record<string, unknown>): string {
    switch (toolName) {
      case 'save_attendance': {
        const records = (params['records'] as unknown[]).length;
        return `שמירת נוכחות ל-${records} תלמידים בתאריך ${params['date'] as string}`;
      }
      case 'generate_exercise_plan':
        return `יצירת תוכנית אימון עבור ${params['studentName'] as string} — ${params['trackName'] as string}`;
      case 'submit_test_result':
        return `הוספת תוצאה עבור ${params['studentName'] as string}: ${params['rawValueFormatted'] as string} — ${params['testTypeNameHe'] as string}`;
      default:
        return toolName;
    }
  }

  private attendanceStatusToHebrew(status: string): string {
    const map: Record<string, string> = {
      PRESENT: 'נוכח',
      ABSENT: 'נעדר',
      LATE: 'מאוחר',
      EXCUSED: 'פטור',
    };
    return map[status] ?? status;
  }
}
