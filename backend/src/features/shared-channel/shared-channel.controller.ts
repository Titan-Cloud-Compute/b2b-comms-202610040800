import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { SharedChannelService } from './shared-channel.service';
import type { PostApiChannelsIdMessagesRequestDto, PostApiChannelsRequestDto } from './shared-channel.dto';

@ApiTags('shared-channel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/channels')
export class SharedChannelController {
  constructor(private readonly sharedchannel: SharedChannelService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  @HttpCode(HttpStatus.CREATED)
  async postApiChannels(@Req() req: Request, @Body() body: PostApiChannelsRequestDto) {
    return this.sharedchannel.createChannel(req.session!.userId, body?.name);
  }

  @Post(':id/messages')
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  async postApiChannelsIdMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: PostApiChannelsIdMessagesRequestDto,
  ) {
    return this.sharedchannel.postMessage(req.session!.userId, id, body?.body);
  }

  @Get()
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  async getApiChannels(@Req() req: Request) {
    const s = req.session!;
    return this.sharedchannel.listChannels(s.userId, String(s.role));
  }
}
