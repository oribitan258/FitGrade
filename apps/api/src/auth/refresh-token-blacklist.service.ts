import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Database-backed blacklist for revoked refresh-token JTI claims. (SEC-002)
 *
 * Replaces the previous in-memory Map so revocations survive API restarts
 * and are visible across all instances in a multi-replica deployment.
 *
 * Architecture:
 *   • Each row stores the JWT's jti (primary key) + expiresAt (mirrors exp).
 *   • An hourly sweep deletes rows whose tokens have already expired naturally,
 *     keeping the table small (bounded by how many sessions log out per 7-day
 *     window rather than growing indefinitely).
 *   • All methods are async — the caller in AuthService already awaits them.
 *
 * Failure behaviour:
 *   • revoke() — if the DB write fails, the error propagates; the controller
 *     catches it and returns 500. The logout cookie is still cleared, so the
 *     browser session ends. The token MAY be reusable until natural expiry in
 *     this rare case — acceptable vs. silently losing the revocation.
 *   • isRevoked() — if the DB read fails, the error propagates as 500. This
 *     is intentionally fail-safe: it is better to surface an error than to
 *     silently pass through a potentially revoked token.
 */
@Injectable()
export class RefreshTokenBlacklistService {
  private readonly logger = new Logger(RefreshTokenBlacklistService.name);

  private sweepHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.sweepHandle = setInterval(() => {
      void this.cleanExpired();
    }, 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.sweepHandle !== null) {
      clearInterval(this.sweepHandle);
    }
  }

  /**
   * Persists a revoked JTI to the database.
   * Uses upsert so calling revoke() twice on the same jti is idempotent.
   *
   * @param jti   — The `jti` claim from the refresh token payload.
   * @param expMs — Token expiry as milliseconds-since-epoch (payload.exp * 1000).
   */
  async revoke(jti: string, expMs: number): Promise<void> {
    await this.prisma.revokedToken.upsert({
      where: { jti },
      create: { jti, expiresAt: new Date(expMs) },
      update: { expiresAt: new Date(expMs) },
    });
    this.logger.log(`Refresh token revoked: jti=${jti}`);
  }

  /**
   * Returns true if the jti is in the revoked_tokens table and the token
   * has not yet expired naturally (expired tokens are harmless but kept until
   * the sweep runs).
   */
  async isRevoked(jti: string): Promise<boolean> {
    const row = await this.prisma.revokedToken.findUnique({
      where: { jti },
      select: { expiresAt: true },
    });
    if (row === null) return false;
    // If the token has already expired naturally, it's dead regardless.
    return row.expiresAt > new Date();
  }

  /** Deletes all rows whose tokens have already passed their natural expiry. */
  private async cleanExpired(): Promise<void> {
    const { count } = await this.prisma.revokedToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) {
      this.logger.log(`Revoked token sweep: removed ${count} expired entries`);
    }
  }
}
