import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import {
  GetApiNotificationsPreferencesResponseDto,
  PutApiNotificationsPreferencesRequestDto,
  PutApiNotificationsPreferencesResponseDto,
} from './notification-preferences.dto';

@ApiTags('notification-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
@Controller('api/notifications')
export class NotificationPreferencesController {
  constructor(private readonly notificationpreferences: NotificationPreferencesService) {}

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  async putApiNotificationsPreferences(
    @Req() req: Request,
    @Body() body: PutApiNotificationsPreferencesRequestDto,
  ): Promise<PutApiNotificationsPreferencesResponseDto> {
    if (!body || typeof body.orderAlerts !== 'boolean' || typeof body.messageAlerts !== 'boolean') {
      throw new BadRequestException('orderAlerts and messageAlerts must be booleans');
    }
    const { userId } = (req as any).session as { userId: string };
    return this.notificationpreferences.upsert(userId, body.orderAlerts, body.messageAlerts);
  }

  @Get('preferences')
  async getApiNotificationsPreferences(@Req() req: Request): Promise<GetApiNotificationsPreferencesResponseDto> {
    const { userId } = (req as any).session as { userId: string };
    return this.notificationpreferences.get(userId);
  }
}
