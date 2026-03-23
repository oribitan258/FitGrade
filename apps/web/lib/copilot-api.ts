/**
 * Copilot API — typed fetch wrappers and starter prompt mapping.
 *
 * All calls delegate to `apiRequest` from api-client so the Bearer token
 * is attached automatically and 401 redirects are handled uniformly.
 */
import { apiRequest } from './api-client';
import type { AiActionLogItem, CopilotChatRequest } from '@fitgrade/types';

// ─── SSE stream URL ────────────────────────────────────────────────────────

// process.env['API_URL'] is injected by next.config so it is available on
// the client bundle too — same source-of-truth as api-client.ts.
const API_BASE: string = process.env['API_URL'] ?? 'http://localhost:3001/api';

/** Returns the EventSource URL for a given stream token (no auth header needed — token is in path). */
export function getCopilotStreamUrl(streamToken: string): string {
  return `${API_BASE}/copilot/stream/${streamToken}`;
}

// ─── Starter prompts ──────────────────────────────────────────────────────

const STARTER_PROMPTS_MAP = {
  dashboard:       ['מי הכי צריך עזרה?', 'יש תוצאות חסרות?', 'מה המצב הכולל של הכיתות?'],
  class:           ['סכם את הכיתה הזאת', 'מי לא עמד בנורמה?', 'צור תוכנית לתלמיד חלש'],
  student:         ['עדכן את התוכנית של התלמיד הזה', 'מה הציון הנוכחי שלו?', 'שמור נוכחות לתלמיד זה'],
  default:         ['מי נכשל?', 'מה הנורמה לריצה?', 'הראה לי ציונים חסרים'],
} as const;

/** Returns 3 contextual starter prompt strings based on the current route. */
export function getStarterPrompts(
  pathname: string,
  classId: string | null,
  studentId: string | null,
): string[] {
  if (studentId && classId) return [...STARTER_PROMPTS_MAP.student];
  if (classId)             return [...STARTER_PROMPTS_MAP.class];
  if (pathname === '/dashboard') return [...STARTER_PROMPTS_MAP.dashboard];
  return [...STARTER_PROMPTS_MAP.default];
}

// ─── Typed API wrappers ────────────────────────────────────────────────────

/** POST /copilot/chat — returns a short-lived stream token. */
export async function initCopilotChat(
  body: CopilotChatRequest,
): Promise<{ streamToken: string }> {
  return apiRequest<{ streamToken: string }>('/copilot/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** POST /copilot/confirm/:actionId — approve and execute a pending WRITE action (204). */
export async function confirmCopilotAction(actionId: string): Promise<void> {
  return apiRequest<void>(`/copilot/confirm/${actionId}`, { method: 'POST' });
}

/** DELETE /copilot/actions/:actionId — cancel a pending action without executing it (204). */
export async function cancelCopilotAction(actionId: string): Promise<void> {
  return apiRequest<void>(`/copilot/actions/${actionId}`, { method: 'DELETE' });
}

/** GET /copilot/history — last 50 AI action log entries for the authenticated teacher. */
export async function getCopilotHistory(): Promise<AiActionLogItem[]> {
  return apiRequest<AiActionLogItem[]>('/copilot/history');
}

/** POST /copilot/actions/:logId/revert — roll back a previously executed WRITE action (204). */
export async function revertCopilotAction(logId: string): Promise<void> {
  return apiRequest<void>(`/copilot/actions/${logId}/revert`, { method: 'POST' });
}

/** DELETE /copilot/conversations/:conversationId — clear in-memory conversation history (204). */
export async function deleteCopilotConversation(conversationId: string): Promise<void> {
  return apiRequest<void>(`/copilot/conversations/${conversationId}`, { method: 'DELETE' });
}
