import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  async createChannel(userId: string, name: unknown): Promise<PostApiChannelsResponseDto> {
    if (typeof name !== 'string' || !name.trim()) throw new BadRequestException('name is required');
    const vendor = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!vendor) throw new ForbiddenException('vendor profile required to create a channel');
    const channel = await this.model('Channel').create({
      data: { name: name.trim(), vendorId: vendor.id, vendorProfileId: vendor.id },
    });
    return { id: channel.id, name: channel.name };
  }

  async listChannels(userId: string, role: string): Promise<GetApiChannelsResponseDto[]> {
    let where = {};
    if (role === 'VENDOR') {
      const vendor = await this.model('VendorProfile').findUnique({ where: { userId } });
      if (!vendor) return [];
      where = { vendorId: vendor.id };
    }
    const channels = await this.model('Channel').findMany({ where, orderBy: { createdAt: 'desc' } });
    return channels.map((c) => ({ id: c.id, name: c.name }));
  }

  async postMessage(userId: string, channelId: string, body: unknown): Promise<PostApiChannelsIdMessagesResponseDto> {
    if (typeof body !== 'string' || !body.trim()) throw new BadRequestException('body is required');
    const channel = await this.model('Channel').findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('channel not found');
    const msg = await this.model('Message').create({
      data: { body: body.trim(), channelId, senderId: userId },
    });
    return { id: msg.id, body: msg.body, channelId: msg.channelId };
  }
}
