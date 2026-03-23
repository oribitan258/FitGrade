import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Content } from '@google/generative-ai';

/** Maximum Content turns retained per conversation (oldest are evicted first). */
const MAX_TURNS = 20;

/** Conversation TTL: 30 minutes of inactivity clears the history. */
const TTL_MS = 30 * 60 * 1_000;

/** Cleanup sweep runs every 60 seconds to evict stale conversations. */
const CLEANUP_INTERVAL_MS = 60_000;

interface HistoryEntry {
  contents: Content[];
  expiresAt: number;
}

/**
 * In-memory store for per-conversation Gemini message history.
 * Each conversation is identified by a UUID that resets when the panel is closed.
 *
 * Thread safety: Node.js is single-threaded; no mutex is required.
 */
@Injectable()
export class ConversationHistoryStore implements OnModuleDestroy {
  private readonly store = new Map<string, HistoryEntry>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evict(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Returns the current Content history for the given conversation.
   * Returns an empty array if the conversation is unknown or has expired.
   */
  get(conversationId: string): Content[] {
    const entry = this.store.get(conversationId);
    if (!entry || entry.expiresAt < Date.now()) {
      this.store.delete(conversationId);
      return [];
    }
    return entry.contents;
  }

  /**
   * Replaces the full conversation history with the provided contents.
   * Trims to MAX_TURNS to prevent unbounded growth.
   * Also refreshes the TTL so active conversations stay alive.
   */
  set(conversationId: string, contents: Content[]): void {
    const trimmed = contents.length > MAX_TURNS
      ? contents.slice(contents.length - MAX_TURNS)
      : contents;
    this.store.set(conversationId, {
      contents: trimmed,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  /**
   * Explicitly deletes a conversation (called when the panel closes).
   */
  delete(conversationId: string): void {
    this.store.delete(conversationId);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  /** Evicts all expired entries. Called periodically by the cleanup timer. */
  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        this.store.delete(key);
      }
    }
  }
}
