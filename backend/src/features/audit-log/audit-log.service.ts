import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['AuditEntry'] as const);
  }

  async list() {
    return this.model('AuditEntry').findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, userId: true, createdAt: true },
    });
  }

  async create(data: { action: string; userId: string }) {
    return this.model('AuditEntry').create({
      data: { action: data.action, userId: data.userId },
      select: { id: true, action: true, createdAt: true },
    });
  }
}
