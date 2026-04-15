import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  GoneException,
  HttpCode,
  HttpStatus,
  Logger,
  MessageEvent,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable, Subject } from 'rxjs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CopilotService } from './copilot.service';
import { CopilotChatDto } from './dto/copilot-chat.dto';
import { AiActionLogDto } from './dto/ai-action-log.dto';
import type { CopilotSSEEvent } from '@fitgrade/types';

@ApiTags('copilot')
@Roles('TEACHER')
@ApiBearerAuth()
@Controller('copilot')
export class CopilotController {
  private readonly logger = new Logger(CopilotController.name);

  constructor(private readonly copilotService: CopilotService) {}

  // ─────────────────────────────────────────────
  // Step 1 — Initiate a chat request
  // ─────────────────────────────────────────────

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate a Copilot chat — returns a short-lived stream token' })
  @ApiResponse({ status: 200, description: 'Stream token created', schema: { example: { streamToken: 'uuid' } } })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Teacher role required' })
  initChat(
    @Body() dto: CopilotChatDto,
    @CurrentUser() user: JwtPayload,
  ): { streamToken: string } {
    const streamToken = this.copilotService.initChat({
      message: dto.message,
      conversationId: dto.conversationId,
      context: dto.context,
      teacherId: user.sub,
    });
    return { streamToken };
  }

  // ─────────────────────────────────────────────
  // Step 2 — Open SSE stream
  // ─────────────────────────────────────────────

  @Sse('stream/:token')
  @Public() // EventSource cannot send Authorization headers; the streamToken is the auth mechanism
  @Throttle({ default: { ttl: 60_000, limit: 20 } }) // Stricter limit — stream token is the sole auth
  @ApiOperation({ summary: 'Open SSE stream for a previously initiated chat' })
  @ApiResponse({ status: 200, description: 'Server-Sent Events stream of CopilotSSEEvent' })
  @ApiResponse({ status: 404, description: 'Stream token invalid or expired' })
  stream(@Param('token') token: string): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    const emit = (event: CopilotSSEEvent): void => {
      subject.next({ data: event } as MessageEvent);
      if (event.type === 'done' || event.type === 'error') {
        subject.complete();
      }
    };

    // Run asynchronously — errors are forwarded via the `error` SSE event.
    void this.copilotService.runStream(token, emit).catch((err: unknown) => {
      this.logger.error('Unhandled stream error', err);
      emit({ type: 'error', message: 'שגיאה בלתי צפויה' });
    });

    return subject.asObservable();
  }

  // ─────────────────────────────────────────────
  // Approve a pending WRITE action
  // ─────────────────────────────────────────────

  @Post('confirm/:actionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Approve and execute a pending Copilot WRITE action' })
  @ApiResponse({ status: 204, description: 'Action executed successfully' })
  @ApiResponse({ status: 403, description: 'Action does not belong to this teacher' })
  @ApiResponse({ status: 410, description: 'Action expired (60s TTL exceeded)' })
  async confirmAction(
    @Param('actionId') actionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    try {
      await this.copilotService.confirmAction(actionId, user.sub);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'EXPIRED') throw new GoneException('הפעולה פגה תוקף');
        if (err.message === 'FORBIDDEN') throw new ForbiddenException();
      }
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // Cancel a pending WRITE action
  // ─────────────────────────────────────────────

  @Delete('actions/:actionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a pending Copilot WRITE action (no audit entry written)' })
  @ApiResponse({ status: 204, description: 'Action cancelled' })
  @ApiResponse({ status: 403, description: 'Action does not belong to this teacher' })
  cancelAction(
    @Param('actionId') actionId: string,
    @CurrentUser() user: JwtPayload,
  ): void {
    this.copilotService.cancelActionForOwner(actionId, user.sub);
  }

  // ─────────────────────────────────────────────
  // AI Action History
  // ─────────────────────────────────────────────

  @Get('history')
  @ApiOperation({ summary: 'Returns last 50 AI WRITE actions for the authenticated teacher' })
  @ApiResponse({ status: 200, description: 'List of AI action log entries', type: [AiActionLogDto] })
  async getHistory(@CurrentUser() user: JwtPayload): Promise<AiActionLogDto[]> {
    return this.copilotService.getHistory(user.sub);
  }

  // ─────────────────────────────────────────────
  // Revert a previous WRITE action
  // ─────────────────────────────────────────────

  @Post('actions/:logId/revert')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revert a previously executed AI WRITE action' })
  @ApiResponse({ status: 204, description: 'Action reverted successfully' })
  @ApiResponse({ status: 403, description: 'Action does not belong to this teacher' })
  @ApiResponse({ status: 404, description: 'Action not found' })
  @ApiResponse({ status: 410, description: 'Action has already been reverted' })
  async revertAction(
    @Param('logId') logId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.copilotService.revertAction(logId, user.sub);
  }

  // ─────────────────────────────────────────────
  // Delete conversation history
  // ─────────────────────────────────────────────

  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear conversation history (called when the Copilot panel closes)' })
  @ApiResponse({ status: 204, description: 'Conversation cleared' })
  @ApiResponse({ status: 403, description: 'Conversation does not belong to this teacher' })
  deleteConversation(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: JwtPayload,
  ): void {
    this.copilotService.deleteConversationForOwner(conversationId, user.sub);
  }
}
