import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import {
  CreateAuditEntrySchema,
  GetApiAdminAuditLogResponseDto,
  PostApiAdminAuditLogResponseDto,
} from './audit-log.dto';
import { AuditLogService } from './audit-log.service';

@ApiTags('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/audit-log')
export class AuditLogController {
  constructor(private readonly auditlog: AuditLogService) {}

  @Get()
  async getApiAdminAuditLog(): Promise<GetApiAdminAuditLogResponseDto[]> {
    const rows = await this.auditlog.list();
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Post()
  @HttpCode(201)
  async postApiAdminAuditLog(
    @Body() body: unknown,
  ): Promise<PostApiAdminAuditLogResponseDto> {
    const parsed = CreateAuditEntrySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const entry = await this.auditlog.create(parsed.data);
    return {
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
