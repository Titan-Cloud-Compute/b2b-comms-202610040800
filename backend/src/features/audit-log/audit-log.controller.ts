import { Body, Controller, HttpCode, UseGuards, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { AuditLogService } from './audit-log.service';
import {
  GetApiAdminAuditLogResponseDto,
  PostApiAdminAuditLogRequestDto,
  PostApiAdminAuditLogResponseDto,
} from './audit-log.dto';

@ApiTags('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/audit-log')
export class AuditLogController {
  constructor(private readonly auditlog: AuditLogService) {}

  @Get()
  async getApiAdminAuditLog(): Promise<GetApiAdminAuditLogResponseDto[]> {
    return this.auditlog.list();
  }

  @Post()
  @HttpCode(201)
  async postApiAdminAuditLog(
    @Body() body: PostApiAdminAuditLogRequestDto,
  ): Promise<PostApiAdminAuditLogResponseDto & { userId: string }> {
    return this.auditlog.create(body);
  }
}
