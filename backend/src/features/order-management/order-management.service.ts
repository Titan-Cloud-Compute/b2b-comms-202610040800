import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersRequestDto,
  PostApiOrdersResponseDto,
} from './order-management.dto';

@Injectable()
export class OrderManagementService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Order', 'OrderItem', 'Customer', 'VendorProfile'] as const);
  }

  async createOrder(
    userId: string,
    dto: PostApiOrdersRequestDto,
  ): Promise<PostApiOrdersResponseDto> {
    // Resolve the caller's Customer row
    const customer = await this.model('Customer').findUnique({ where: { userId } });
    if (!customer) {
      throw new ConflictException('No customer record for this account');
    }

    // Validate vendorId
    const vendor = await this.model('VendorProfile').findUnique({ where: { id: dto.vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const order = await this.model('Order').create({
      data: {
        status: 'pending',
        customerId: customer.id,
        vendorId: dto.vendorId,
        orderItems: {
          create: (dto.items ?? []).map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });

    return { id: order.id, status: order.status, customerId: order.customerId };
  }

  async listOrders(userId: string, role: string): Promise<GetApiOrdersResponseDto[]> {
    let where: Record<string, unknown> = {};

    if (role === 'CUSTOMER') {
      const customer = await this.model('Customer').findUnique({ where: { userId } });
      if (!customer) return [];
      where = { customerId: customer.id };
    } else if (role === 'VENDOR') {
      const vendor = await this.model('VendorProfile').findUnique({ where: { userId } });
      if (!vendor) return [];
      where = { vendorId: vendor.id };
    }
    // ADMIN: no filter — returns all

    const orders = await this.model('Order').findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { orderItems: true },
    });

    return orders.map((o: any) => ({
      id: o.id,
      status: o.status,
      vendorId: o.vendorId,
      customerId: o.customerId,
      items: (o.orderItems ?? []).map((i: any) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    }));
  }

  async confirmOrder(
    id: string,
    userId: string,
    role: string,
    estimatedDelivery: string,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    const order = await this.model('Order').findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (role === 'VENDOR') {
      const vendor = await this.model('VendorProfile').findUnique({ where: { userId } });
      if (!vendor || order.vendorId !== vendor.id) {
        throw new NotFoundException('Order not found');
      }
    }

    if (order.status !== 'pending') {
      throw new ConflictException('Order is not pending');
    }

    const result = await this.model('Order').updateMany({
      where: { id, status: 'pending' },
      data: { status: 'confirmed' },
    });

    if (result.count === 0) {
      throw new ConflictException('Order is not pending');
    }

    return { id, status: 'confirmed', estimatedDelivery };
  }
}
