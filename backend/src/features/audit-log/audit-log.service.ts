import { BadRequestException, Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiAdminAuditLogResponseDto,
  PostApiAdminAuditLogRequestDto,
  PostApiAdminAuditLogResponseDto,
} from './audit-log.dto';

interface AuditEntryRow {
  id: string;
  action: string;
  userId: string;
  createdAt: Date;
}

function toDto(row: AuditEntryRow): GetApiAdminAuditLogResponseDto {
  return {
    id: row.id,
    action: row.action,
    userId: row.userId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

@Injectable()
export class AuditLogService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['AuditEntry'] as const);
  }

  /** All audit entries, oldest first (chronological order). */
  async list(): Promise<GetApiAdminAuditLogResponseDto[]> {
    const rows: AuditEntryRow[] = await this.prisma.auditEntry.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, userId: true, createdAt: true },
    });
    return rows.map(toDto);
  }

  /** Store a new audit entry and return the created record. */
  async create(
    body: PostApiAdminAuditLogRequestDto,
  ): Promise<PostApiAdminAuditLogResponseDto & { userId: string }> {
    const action = typeof body?.action === 'string' ? body.action.trim() : '';
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!action) throw new BadRequestException('action is required');
    if (!userId) throw new BadRequestException('userId is required');
    const row: AuditEntryRow = await this.prisma.auditEntry.create({
      data: { action, userId },
      select: { id: true, action: true, userId: true, createdAt: true },
    });
    return toDto(row);
  }
}
