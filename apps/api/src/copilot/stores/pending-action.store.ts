import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PendingActionPreview } from '@fitgrade/types';

// ─────────────────────────────────────────────
// Stream Token Store — 5 second TTL
// Bridges the POST /chat request → GET /stream/:token EventSource.
// ─────────────────────────────────────────────

/** Lifetime for a stream token (milliseconds). */
const STREAM_TOKEN_TTL_MS = 5_000;

export interface StreamTokenPayload {
  message: string;
  conversationId: string;
  context: {
    currentRoute: string;
    classId: string | null;
    studentId: string | null;
    selectedDate: string | null;
  };
  teacherId: string;
}

// ─────────────────────────────────────────────
// Pending Action Store — 60 second TTL
// Holds WRITE tool calls awaiting teacher approval.
// ─────────────────────────────────────────────

/** Lifetime for a pending action before it auto-expires (milliseconds). */
const PENDING_ACTION_TTL_MS = 60_000;

/** Cleanup sweep interval for both stores (milliseconds). */
const CLEANUP_INTERVAL_MS = 10_000;

export interface PendingActionEntry {
  toolName: string;
  params: Record<string, unknown>;
  preview: PendingActionPreview;
  teacherId: string;
  expiresAt: number;
}

/**
 * In-memory store for:
 *  1. Stream tokens — 5s TTL, bridges POST /chat → EventSource GET /stream/:token
 *  2. Pending actions — 60s TTL, holds WRITE tool calls until teacher approves/cancels
 */
@Injectable()
export class PendingActionStore implements OnModuleDestroy {
  private readonly streamTokens = new Map<string, StreamTokenPayload & { expiresAt: number }>();
  private readonly pendingActions = new Map<string, PendingActionEntry>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evict(), CLEANUP_INTERVAL_MS);
  }

  // ── Stream Token ─────────────────────────────────────────────────────────

  /** Stores a request payload and returns a fresh stream token UUID. */
  createStreamToken(payload: StreamTokenPayload): string {
    const token = randomUUID();
    this.streamTokens.set(token, {
      ...payload,
      expiresAt: Date.now() + STREAM_TOKEN_TTL_MS,
    });
    return token;
  }

  /** Returns the payload for a stream token and deletes it (single-use). */
  consumeStreamToken(token: string): StreamTokenPayload | null {
    const entry = this.streamTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      this.streamTokens.delete(token);
      return null;
    }
    this.streamTokens.delete(token);
    const { expiresAt: _expiresAt, ...payload } = entry;
    return payload;
  }

  // ── Pending Action ────────────────────────────────────────────────────────

  /** Stores a pending WRITE action and returns a fresh action ID UUID. */
  createPendingAction(entry: Omit<PendingActionEntry, 'expiresAt'>): string {
    const actionId = randomUUID();
    this.pendingActions.set(actionId, {
      ...entry,
      expiresAt: Date.now() + PENDING_ACTION_TTL_MS,
    });
    return actionId;
  }

  /** Returns a pending action if it still exists and has not expired. */
  getPendingAction(actionId: string): PendingActionEntry | null {
    const entry = this.pendingActions.get(actionId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.pendingActions.delete(actionId);
      return null;
    }
    return entry;
  }

  /** Removes a pending action (on cancel or after execution). */
  deletePendingAction(actionId: string): void {
    this.pendingActions.delete(actionId);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.streamTokens.entries()) {
      if (entry.expiresAt < now) this.streamTokens.delete(key);
    }
    for (const [key, entry] of this.pendingActions.entries()) {
      if (entry.expiresAt < now) this.pendingActions.delete(key);
    }
  }
}
