import { Injectable, Logger } from '@nestjs/common';
import type { AuditAction } from '@prisma/client';
import { AuditLogRepository } from './audit-log.repository';

export interface AuditLogParams {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

/**
 * Cross-cutting service for writing immutable audit log entries.
 *
 * Failures are caught and logged server-side but never propagated — audit
 * logging must not block or roll back the primary operation. The caller's
 * transaction has already committed before `log()` is invoked.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  /**
   * Writes one append-only audit log entry.
   * Safe to fire-and-forget: errors are swallowed after logging.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.auditLogRepository.create(params);
    } catch (err) {
      // Audit failure must never break the primary operation.
      this.logger.error(
        `Audit log write failed: action=${params.action} entity=${params.entityType}:${params.entityId} actor=${params.actorId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
