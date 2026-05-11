import { Injectable, Logger } from '@nestjs/common';

/**
 * In-memory blacklist for revoked refresh-token JTI claims.
 *
 * When a teacher logs out, their refresh token's `jti` (JWT ID) is added here
 * so the `/auth/refresh` endpoint will reject it even before the token's natural
 * 7-day expiry.  This closes the gap where a stolen refresh token remains valid
 * after logout.
 *
 * Architecture:
 *   • Each entry has an `expiresAt` timestamp matching the token's `exp` claim.
 *   • A periodic sweep (`cleanExpired`) removes entries whose tokens would have
 *     expired naturally — keeping memory bounded without a Redis dependency.
 *   • Sweep runs every hour inside `onModuleInit`; also called inline to
 *     piggyback cleanup onto every revoke() call.
 *
 * Limitations:
 *   • In-memory only — does NOT survive process restarts or horizontal scale-out.
 *   • For multi-instance deployments, replace with a Redis SET (same interface).
 */
@Injectable()
export class RefreshTokenBlacklistService {
  private readonly logger = new Logger(RefreshTokenBlacklistService.name);

  /** jti → expiry timestamp (ms since epoch) */
  private readonly blacklist = new Map<string, number>();

  /** Sweep interval handle — cleaned up on module destroy. */
  private sweepHandle: ReturnType<typeof setInterval> | null = null;

  onModuleInit(): void {
    // Sweep every hour to remove naturally-expired entries.
    this.sweepHandle = setInterval(() => {
      this.cleanExpired();
    }, 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.sweepHandle !== null) {
      clearInterval(this.sweepHandle);
    }
  }

  /**
   * Adds a refresh token's `jti` to the blacklist.
   * @param jti   — The `jti` claim from the refresh token payload.
   * @param expMs — Token expiry as milliseconds-since-epoch (payload.exp * 1000).
   */
  revoke(jti: string, expMs: number): void {
    this.blacklist.set(jti, expMs);
    this.cleanExpired();
    this.logger.log(`Refresh token revoked: jti=${jti}`);
  }

  /**
   * Returns true if the `jti` is in the blacklist AND the token has not yet
   * expired naturally (expired tokens are harmless — no need to keep them).
   */
  isRevoked(jti: string): boolean {
    const expMs = this.blacklist.get(jti);
    if (expMs === undefined) return false;
    if (Date.now() > expMs) {
      // Natural expiry — remove and report as not revoked (token is already dead)
      this.blacklist.delete(jti);
      return false;
    }
    return true;
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [jti, expMs] of this.blacklist) {
      if (now > expMs) this.blacklist.delete(jti);
    }
  }
}
