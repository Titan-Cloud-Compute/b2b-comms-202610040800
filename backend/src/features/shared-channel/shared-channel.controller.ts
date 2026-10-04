import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { CreateChannelSchema, PostMessageSchema } from './shared-channel.dto';
import { SharedChannelService } from './shared-channel.service';

@ApiTags('shared-channel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/channels')
export class SharedChannelController {
  constructor(private readonly sharedchannel: SharedChannelService) {}

  @Post()
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async createChannel(@Body() body: unknown, @Req() req: Request) {
    const result = CreateChannelSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.issues[0]?.message ?? 'Invalid request body');
    }
    const session = req.session!;
    return this.sharedchannel.createChannel(session.userId, result.data.name);
  }

  @Get()
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER, UserRole.ADMIN)
  async listChannels(@Req() req: Request) {
    const session = req.session!;
    return this.sharedchannel.listChannels(session.userId, session.role);
  }

  @Post(':id/messages')
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER, UserRole.ADMIN)
  async postMessage(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const result = PostMessageSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.issues[0]?.message ?? 'Invalid request body');
    }
    const session = req.session!;
    return this.sharedchannel.postMessage(id, session.userId, session.role, result.data.body);
  }
}
