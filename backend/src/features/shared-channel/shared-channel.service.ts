import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiChannelsResponseDto,
  PostApiChannelsIdMessagesResponseDto,
  PostApiChannelsResponseDto,
} from './shared-channel.dto';

@Injectable()
export class SharedChannelService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Channel', 'Message', 'VendorProfile'] as const);
  }

  async createChannel(userId: string, name: string): Promise<PostApiChannelsResponseDto> {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) {
      throw new ConflictException('Complete vendor onboarding before creating channels');
    }
    const channel = await this.model('Channel').create({
      data: {
        name,
        vendorId: profile.id,
        vendorProfileId: profile.id,
      },
    });
    return { id: channel.id, name: channel.name };
  }

  async listChannels(userId: string, role: UserRole): Promise<GetApiChannelsResponseDto[]> {
    if (role === UserRole.VENDOR) {
      const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
      if (!profile) return [];
      const channels = await this.model('Channel').findMany({
        where: { vendorProfileId: profile.id },
        orderBy: { createdAt: 'desc' },
      });
      return channels.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
    }
    const channels = await this.model('Channel').findMany({
      orderBy: { createdAt: 'desc' },
    });
    return channels.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
  }

  async postMessage(
    channelId: string,
    userId: string,
    role: UserRole,
    body: string,
  ): Promise<PostApiChannelsIdMessagesResponseDto> {
    const channel = await this.model('Channel').findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (role === UserRole.VENDOR) {
      const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
      if (!profile || channel.vendorProfileId !== profile.id) {
        throw new ForbiddenException('You can only post to your own channels');
      }
    }

    const message = await this.model('Message').create({
      data: {
        body,
        channelId,
        senderId: userId,
      },
    });
    return { id: message.id, body: message.body, channelId: message.channelId };
  }
}
