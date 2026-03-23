/**
 * @fitgrade/types — Copilot shared types
 *
 * Consumed by both `apps/api` (NestJS) and `apps/web` (Next.js).
 * All user-facing strings referenced here are in Hebrew.
 */

// ─────────────────────────────────────────────
// SSE EVENT STREAM
// ─────────────────────────────────────────────

export type CopilotSSEEventType =
  | 'thinking'        // Spinner shown while Claude is processing
  | 'token'           // Streaming text delta — append to current message
  | 'tool_call'       // READ tool is firing — show "נטען מידע..." badge
  | 'tool_result'     // READ tool returned — dismiss badge
  | 'pending_action'  // WRITE tool proposed — show PendingActionCard
  | 'error'           // Irrecoverable error — show error toast
  | 'done';           // Stream complete

export interface CopilotSSEEvent {
  type: CopilotSSEEventType;
  /** Streaming text chunk — present on 'token' events */
  delta?: string;
  /** Hebrew display name of the tool — present on 'tool_call' and 'tool_result' events */
  toolName?: string;
  /** Pending action ID for HITL confirmation — present on 'pending_action' events */
  actionId?: string;
  /** Structured preview for HITL card — present on 'pending_action' events */
  preview?: PendingActionPreview;
  /** Hebrew error message — present on 'error' events */
  message?: string;
}

// ─────────────────────────────────────────────
// HITL — PENDING ACTION PREVIEW
// Structured preview shown in the PendingActionCard before teacher approves a WRITE action.
// ─────────────────────────────────────────────

export interface AttendancePreviewRow {
  studentName: string;
  /** Hebrew status label, e.g. "נוכח" | "נעדר" | "מאוחר" | "פטור" */
  statusHe: string;
}

export interface AttendancePendingPreview {
  toolName: 'save_attendance';
  className: string;
  date: string; // ISO date string YYYY-MM-DD
  rows: AttendancePreviewRow[];
}

export interface ExercisePlanPendingPreview {
  toolName: 'generate_exercise_plan';
  studentName: string;
  trackName: string;
  week1Focus: string;
}

export interface TestResultPendingPreview {
  toolName: 'submit_test_result';
  studentName: string;
  testTypeNameHe: string;
  rawValue: string; // Formatted with unit, e.g. "12.4 שניות"
}

export type PendingActionPreview =
  | AttendancePendingPreview
  | ExercisePlanPendingPreview
  | TestResultPendingPreview;

// ─────────────────────────────────────────────
// CONTEXT — Injected with every chat request
// ─────────────────────────────────────────────

export interface CopilotPageContext {
  /** Full pathname, e.g. '/classes/abc123/students/xyz' */
  currentRoute: string;
  /** classId extracted from route params, null if not on a class page */
  classId: string | null;
  /** studentId extracted from route params, null if not on a student page */
  studentId: string | null;
  /** ISO date string YYYY-MM-DD, defaults to today */
  selectedDate: string | null;
}

// ─────────────────────────────────────────────
// CHAT REQUEST BODY
// ─────────────────────────────────────────────

export interface CopilotChatRequest {
  message: string;
  /** UUID that resets when the panel is closed */
  conversationId: string;
  context: CopilotPageContext;
}

// ─────────────────────────────────────────────
// UI — MESSAGE (client-side only)
// ─────────────────────────────────────────────

export type CopilotMessageRole = 'user' | 'assistant';

export interface CopilotMessage {
  id: string;
  role: CopilotMessageRole;
  content: string;
  /** ISO timestamp */
  createdAt: string;
  /** True while a 'token' stream is still appending */
  isStreaming?: boolean;
}

// ─────────────────────────────────────────────
// UI — PANEL STATE MACHINE
// ─────────────────────────────────────────────

export type CopilotPanelState =
  | 'idle'
  | 'thinking'
  | 'streaming_answer'
  | 'pending_action'
  | 'executing';

export type CopilotPanelTab = 'chat' | 'history';

// ─────────────────────────────────────────────
// AI ACTION LOG — history list item
// Returned by GET /api/copilot/history
// snapshot field is excluded from list view (only on expand)
// ─────────────────────────────────────────────

export interface AiActionLogItem {
  id: string;
  /** Internal tool name, e.g. "save_attendance" */
  toolName: string;
  /** Pre-generated Hebrew description, e.g. "שמירת נוכחות ל-15 תלמידים בכיתה י׳" */
  summary: string;
  /** The params that were passed to the tool (for expand detail view) */
  params: Record<string, unknown>;
  /** null = action is still active; ISO string = has been reverted */
  revertedAt: string | null;
  /** ISO timestamp of when the action was executed */
  createdAt: string;
}

export interface AiActionLogDetail extends AiActionLogItem {
  /** State snapshot captured before the write — shown in expand detail view */
  snapshot: Record<string, unknown>;
}
