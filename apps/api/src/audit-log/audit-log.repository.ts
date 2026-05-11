import { Injectable } from '@nestjs/common';
import { type AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogParams {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateAuditLogParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        actorId: params.actorId,
        oldValue: params.oldValue ? (params.oldValue as Prisma.InputJsonValue) : Prisma.DbNull,
        newValue: params.newValue ? (params.newValue as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
  }
}
