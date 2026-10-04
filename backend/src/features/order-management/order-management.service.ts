import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateOrderItemDto,
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersResponseDto,
} from './order-management.dto';

export interface OrderActor {
  userId: string;
  role: string;
}

@Injectable()
export class OrderManagementService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Order', 'OrderItem', 'Customer', 'VendorProfile']);
  }

  /** Ids an order's vendorId may carry for this vendor user (profile id or user id). */
  private async vendorIds(userId: string): Promise<string[]> {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    return profile ? [profile.id, userId] : [userId];
  }

  async create(
    actor: OrderActor,
    vendorId: string,
    items: CreateOrderItemDto[] = [],
  ): Promise<PostApiOrdersResponseDto> {
    if (!vendorId || typeof vendorId !== 'string') {
      throw new BadRequestException('vendorId is required');
    }
    const customer = await this.model('Customer').findUnique({ where: { userId: actor.userId } });
    if (!customer) throw new ForbiddenException('Only customers can place orders');

    const order = await this.model('Order').create({
      data: {
        status: 'pending',
        vendorId,
        customerId: customer.id,
        orderItems: {
          create: (Array.isArray(items) ? items : []).map((i) => ({
            description: String(i.description ?? ''),
            quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
            unitPrice: Number(i.unitPrice) || 0,
          })),
        },
      },
    });
    return { id: order.id, status: order.status, customerId: order.customerId };
  }

  async list(actor: OrderActor): Promise<GetApiOrdersResponseDto[]> {
    let where: Record<string, unknown>;
    if (actor.role === 'ADMIN') {
      where = {};
    } else if (actor.role === 'VENDOR') {
      where = { vendorId: { in: await this.vendorIds(actor.userId) } };
    } else {
      const customer = await this.model('Customer').findUnique({ where: { userId: actor.userId } });
      if (!customer) return [];
      where = { customerId: customer.id };
    }
    const orders = await this.model('Order').findMany({ where, orderBy: { createdAt: 'desc' } });
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      customerId: o.customerId,
      vendorId: o.vendorId,
    }));
  }

  async confirm(
    actor: OrderActor,
    id: string,
    estimatedDelivery: string,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    if (!estimatedDelivery || Number.isNaN(Date.parse(estimatedDelivery))) {
      throw new BadRequestException('estimatedDelivery must be a valid date');
    }
    const order = await this.model('Order').findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (actor.role !== 'ADMIN') {
      const ids = await this.vendorIds(actor.userId);
      if (!ids.includes(order.vendorId)) throw new ForbiddenException('Not your order');
    }
    if (order.status !== 'pending') {
      throw new BadRequestException('Only pending orders can be confirmed');
    }
    const updated = await this.model('Order').update({
      where: { id },
      data: { status: 'confirmed' },
    });
    return { id: updated.id, status: updated.status, estimatedDelivery };
  }
}
