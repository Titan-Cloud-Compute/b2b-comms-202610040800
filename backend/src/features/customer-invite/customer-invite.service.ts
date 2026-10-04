import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiAdminCustomersResponseDto,
  PostApiAdminCustomersInviteResponseDto,
} from './customer-invite.dto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class CustomerInviteService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Customer', 'User']);
  }

  async invite(rawEmail: unknown): Promise<PostApiAdminCustomersInviteResponseDto> {
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!email || !EMAIL_RE.test(email)) {
      throw new BadRequestException('A valid email is required');
    }

    const existing = await this.prisma.customer.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Customer already exists');
    }

    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        const user =
          (await tx.user.findUnique({ where: { email } })) ??
          (await tx.user.create({ data: { email, role: UserRole.CUSTOMER } }));
        return tx.customer.create({ data: { email, userId: user.id } });
      });
      return { customerId: customer.id, email: customer.email, invitationSent: true };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Customer already exists');
      }
      throw err;
    }
  }

  async list(): Promise<GetApiAdminCustomersResponseDto[]> {
    return this.prisma.customer.findMany({
      select: { id: true, email: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
