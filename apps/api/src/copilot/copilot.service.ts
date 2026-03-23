import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from '@google/generative-ai';
import type { Content, Part, ChatSession } from '@google/generative-ai';
import type { CopilotSSEEvent, CopilotPageContext } from '@fitgrade/types';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationHistoryStore } from './stores/conversation-history.store';
import { PendingActionStore, type StreamTokenPayload } from './stores/pending-action.store';
import { GEMINI_TOOLS, getToolCategory, type ToolName } from './copilot-tools';
import { CopilotToolExecutor } from './copilot-tool-executor';
import type { AiActionLogDto } from './dto/ai-action-log.dto';

/** Gemini model to use — free-tier flash model. */
const GEMINI_MODEL = 'gemini-2.0-flash';

/** Max output tokens for a single Gemini response. */
const MAX_TOKENS = 8_192;

/** Max teacher name cache lifetime (5 minutes). */
const TEACHER_CACHE_TTL_MS = 5 * 60 * 1_000;

/** How many AiActionLog rows to return in the history list. */
const HISTORY_PAGE_SIZE = 50;

/** Emit callback type used throughout the streaming loop. */
export type EmitFn = (event: CopilotSSEEvent) => void;

// ─────────────────────────────────────────────
// Teacher name cache (in-memory, per-instance)
// ─────────────────────────────────────────────

interface CachedTeacherName {
  name: string;
  expiresAt: number;
}

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly teacherCache = new Map<string, CachedTeacherName>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly historyStore: ConversationHistoryStore,
    private readonly pendingStore: PendingActionStore,
    private readonly executor: CopilotToolExecutor,
  ) {
    this.genAI = new GoogleGenerativeAI(
      this.config.getOrThrow<string>('GOOGLE_AI_API_KEY'),
    );
  }

  // ─────────────────────────────────────────────
  // Chat Initiation
  // ─────────────────────────────────────────────

  /**
   * Validates the incoming request and returns a short-lived stream token.
   * The browser opens GET /stream/:token as an EventSource to receive the response.
   */
  initChat(payload: StreamTokenPayload): string {
    return this.pendingStore.createStreamToken(payload);
  }

  // ─────────────────────────────────────────────
  // SSE Stream
  // ─────────────────────────────────────────────

  /**
   * Consumes the stream token, runs the full agentic loop, and emits SSE events
   * to the caller via the `emit` callback.
   *
   * Flow:
   *   1. Look up stream token → request payload.
   *   2. Build system prompt + load conversation history.
   *   3. Open a Gemini chat session.
   *   4. Emit `token` events for streaming text.
   *   5. On function_call:
   *      - READ  → execute immediately → send function_response → continue loop.
   *      - WRITE → store pending action → emit `pending_action` → stop loop.
   *   6. Persist updated history. Emit `done` when the loop exits cleanly.
   */
  async runStream(token: string, emit: EmitFn): Promise<void> {
    const payload = this.pendingStore.consumeStreamToken(token);
    if (!payload) {
      emit({ type: 'error', message: 'קישור שידור לא תקין או שפג תוקפו' });
      return;
    }

    emit({ type: 'thinking' });

    try {
      const systemPrompt = await this.buildSystemPrompt(
        payload.context,
        payload.teacherId,
      );

      const history = this.historyStore.get(payload.conversationId);

      const model = this.genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: systemPrompt,
        tools: GEMINI_TOOLS,
        generationConfig: { maxOutputTokens: MAX_TOKENS },
      });

      const chat = model.startChat({ history });

      await this.agenticLoop(chat, payload.message, payload.teacherId, emit);

      // Persist the full conversation history (including the current exchange).
      const updatedHistory = await chat.getHistory();
      this.historyStore.set(payload.conversationId, updatedHistory);

      emit({ type: 'done' });
    } catch (err) {
      this.logger.error('Copilot stream error', err);
      this.emitError(err, emit);
    }
  }

  /**
   * Recursive agentic loop that handles tool use transparently for READ tools
   * and pauses on WRITE tools to await teacher approval.
   */
  private async agenticLoop(
    chat: ChatSession,
    message: string | Part[],
    teacherId: string,
    emit: EmitFn,
    depth = 0,
  ): Promise<void> {
    if (depth > 10) {
      emit({ type: 'error', message: 'הגעת לגבול השאלות — אנא נסח מחדש את הבקשה' });
      return;
    }

    const streamResult = await chat.sendMessageStream(message);

    // Stream text tokens as they arrive.
    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        emit({ type: 'token', delta: text });
      }
    }

    const response = await streamResult.response;
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      // Natural end — streaming text is complete.
      return;
    }

    const functionResponseParts: Part[] = [];
    let hitWriteTool = false;

    for (const call of functionCalls) {
      const category = getToolCategory(call.name);

      if (category === 'READ') {
        emit({ type: 'tool_call', toolName: call.name });

        const result = await this.executor.executeRead(
          call.name as ToolName,
          call.args as Record<string, unknown>,
          teacherId,
        );

        emit({ type: 'tool_result', toolName: call.name });

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { result: result.data },
          },
        });
      } else if (category === 'WRITE') {
        hitWriteTool = true;
        const params = call.args as Record<string, unknown>;
        const preview = this.executor.buildPreview(call.name as ToolName, params);

        const actionId = this.pendingStore.createPendingAction({
          toolName: call.name,
          params,
          preview,
          teacherId,
        });

        emit({ type: 'pending_action', actionId, preview });
        // Stop processing further tool calls after the first WRITE.
        break;
      }
    }

    if (!hitWriteTool && functionResponseParts.length > 0) {
      // All tool calls in this turn were READ — send results and continue loop.
      await this.agenticLoop(chat, functionResponseParts, teacherId, emit, depth + 1);
    }
  }

  // ─────────────────────────────────────────────
  // Confirm Pending Action
  // ─────────────────────────────────────────────

  /**
   * Executes an approved WRITE action.
   * Validates ownership and TTL before executing.
   * Returns `{ logId }` so the frontend can track the action in history.
   */
  async confirmAction(actionId: string, teacherId: string): Promise<{ logId: string }> {
    const entry = this.pendingStore.getPendingAction(actionId);
    if (!entry) {
      throw new Error('EXPIRED');
    }
    if (entry.teacherId !== teacherId) {
      throw new Error('FORBIDDEN');
    }

    this.pendingStore.deletePendingAction(actionId);
    const logId = await this.executor.executeWrite(
      entry.toolName as ToolName,
      entry.params,
      teacherId,
    );

    return { logId };
  }

  // ─────────────────────────────────────────────
  // Conversation Management
  // ─────────────────────────────────────────────

  deleteConversation(conversationId: string): void {
    this.historyStore.delete(conversationId);
  }

  deletePendingAction(actionId: string): void {
    this.pendingStore.deletePendingAction(actionId);
  }

  // ─────────────────────────────────────────────
  // History
  // ─────────────────────────────────────────────

  async getHistory(teacherId: string): Promise<AiActionLogDto[]> {
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

  async revertAction(logId: string, teacherId: string): Promise<void> {
    return this.executor.revertAction(logId, teacherId);
  }

  // ─────────────────────────────────────────────
  // System Prompt
  // ─────────────────────────────────────────────

  private async buildSystemPrompt(
    context: CopilotPageContext,
    teacherId: string,
  ): Promise<string> {
    const teacherName = await this.getTeacherName(teacherId);
    const today = new Date().toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let classContext = '';
    if (context.classId) {
      try {
        const cls = await this.prisma.class.findFirst({
          where: { id: context.classId, teacherId },
          select: { name: true },
        });
        if (cls) {
          classContext = `\nהמורה נמצא כרגע בעמוד הכיתה: ${cls.name} (מזהה: ${context.classId}).`;
        }
      } catch {
        // Non-critical — skip class name enrichment.
      }
    }

    return `אתה עוזר AI חכם למורי חינוך גופני בישראל. שמך "קופילוט FitGrade".

מורה: ${teacherName}
תאריך היום: ${today}
עמוד נוכחי: ${context.currentRoute}${classContext}${context.studentId ? `\nתלמיד במוקד: ${context.studentId}` : ''}

הנחיות:
1. ענה **בעברית בלבד**. אל תשתמש בשפה אחרת.
2. **אל תמציא נתונים.** השתמש תמיד בכלים כדי לשלוף מידע אמיתי ממסד הנתונים.
3. ציוני 0–100 מומרים לתוויות עבריות: מצטיין (90+), טוב מאוד (75-89), טוב (60-74), עובר (50-59), נכשל (49-).
4. **לפני כל פעולת כתיבה** (שמירת נוכחות, יצירת תוכנית, הוספת תוצאה) — השתמש בכלי המתאים ותאר מה אתה עומד לעשות. המורה יאשר לפני הביצוע.
5. היה תמציתי, ידידותי ומקצועי.
6. כשאין לך מידע לשאלה — אמור זאת בכנות ואל תנחש.`;
  }

  private async getTeacherName(teacherId: string): Promise<string> {
    const cached = this.teacherCache.get(teacherId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.name;
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { name: true },
    });

    const name = teacher?.name ?? 'מורה';
    this.teacherCache.set(teacherId, { name, expiresAt: Date.now() + TEACHER_CACHE_TTL_MS });
    return name;
  }

  // ─────────────────────────────────────────────
  // Error helpers
  // ─────────────────────────────────────────────

  private emitError(err: unknown, emit: EmitFn): void {
    if (err instanceof GoogleGenerativeAIFetchError) {
      if (err.status === 400) {
        emit({ type: 'error', message: 'בקשה שגויה — אנא נסח מחדש את השאלה' });
      } else if (err.status === 401 || err.status === 403) {
        emit({ type: 'error', message: 'מפתח Google AI API שגוי — בדוק את GOOGLE_AI_API_KEY ב-env' });
      } else if (err.status === 429) {
        emit({ type: 'error', message: 'חרגת ממגבלת הבקשות — נסה שוב בעוד מספר שניות' });
      } else {
        emit({ type: 'error', message: 'שגיאה בתקשורת עם Google AI' });
      }
    } else {
      emit({ type: 'error', message: 'שגיאה בעיבוד הבקשה, אנא נסה שוב' });
    }
  }
}
