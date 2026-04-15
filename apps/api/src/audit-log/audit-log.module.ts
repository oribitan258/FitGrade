import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository } from './audit-log.repository';

/**
 * Global module — AuditLogService is available in every module without
 * explicit imports. Mirrors the pattern used by PrismaModule.
 */
@Global()
@Module({
  providers: [AuditLogService, AuditLogRepository],
  exports: [AuditLogService],
})
export class AuditLogModule {}
