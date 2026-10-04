import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  Post,
  Get,
  Patch,
  Controller,
} from '@nestjs/common';
import { OrderManagementController } from './order-management.controller';
import { OrderManagementService } from './order-management.service';

// ── Fake Prisma ───────────────────────────────────────────────────────────────

function makePrisma() {
  const customers: any[] = [];
  const vendors: any[] = [];
  const orders: any[] = [];
  const orderItems: any[] = [];

  const customerDelegate = {
    findUnique: jest.fn(async ({ where }: any) => {
      if (where.userId) return customers.find((c) => c.userId === where.userId) ?? null;
      if (where.id) return customers.find((c) => c.id === where.id) ?? null;
      return null;
    }),
  };

  const vendorProfileDelegate = {
    findUnique: jest.fn(async ({ where }: any) => {
      if (where.userId) return vendors.find((v) => v.userId === where.userId) ?? null;
      if (where.id) return vendors.find((v) => v.id === where.id) ?? null;
      return null;
    }),
  };

  const orderDelegate = {
    create: jest.fn(async ({ data }: any) => {
      const items = data.orderItems?.create ?? [];
      const order = {
        id: `ord${orders.length + 1}`,
        status: data.status,
        customerId: data.customerId,
        vendorId: data.vendorId,
        createdAt: new Date(),
      };
      orders.push(order);
      for (const item of items) {
        const oi = { id: `oi${orderItems.length + 1}`, orderId: order.id, ...item };
        orderItems.push(oi);
      }
      return order;
    }),
    findUnique: jest.fn(async ({ where }: any) => {
      return orders.find((o) => o.id === where.id) ?? null;
    }),
    findMany: jest.fn(async ({ where, orderBy, include }: any) => {
      let result = [...orders];
      if (where?.customerId) result = result.filter((o) => o.customerId === where.customerId);
      if (where?.vendorId) result = result.filter((o) => o.vendorId === where.vendorId);
      result.sort((a, b) => b.createdAt - a.createdAt);
      if (include?.orderItems) {
        result = result.map((o) => ({ ...o, orderItems: orderItems.filter((i) => i.orderId === o.id) }));
      }
      return result;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const toUpdate = orders.filter(
        (o) => o.id === where.id && (!where.status || o.status === where.status),
      );
      for (const o of toUpdate) {
        Object.assign(o, data);
      }
      return { count: toUpdate.length };
    }),
  };

  const prisma = {
    customer: customerDelegate,
    vendorProfile: vendorProfileDelegate,
    order: orderDelegate,
    orderItem: {},
  };

  return { prisma, customers, vendors, orders, orderItems };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeService(prisma: any) {
  return new OrderManagementService(prisma as any);
}

// ── Controller metadata tests ─────────────────────────────────────────────────

describe('OrderManagementController — routing metadata', () => {
  it('is registered at controller path "api/orders"', () => {
    const path = Reflect.getMetadata('path', OrderManagementController);
    expect(path).toBe('api/orders');
  });

  it('POST / is on createOrder', () => {
    const method = Reflect.getMetadata('method', OrderManagementController.prototype.createOrder);
    const path = Reflect.getMetadata('path', OrderManagementController.prototype.createOrder);
    // NestJS RequestMethod: GET=0, POST=1, PUT=2, DELETE=3, PATCH=4
    expect(method).toBe(1 /* RequestMethod.POST */);
    expect(path).toBe('/');
  });

  it('GET / is on listOrders', () => {
    const method = Reflect.getMetadata('method', OrderManagementController.prototype.listOrders);
    const path = Reflect.getMetadata('path', OrderManagementController.prototype.listOrders);
    // NestJS RequestMethod: GET=0
    expect(method).toBe(0 /* RequestMethod.GET */);
    expect(path).toBe('/');
  });

  it('PATCH :id/confirm is on confirmOrder', () => {
    const method = Reflect.getMetadata('method', OrderManagementController.prototype.confirmOrder);
    const path = Reflect.getMetadata('path', OrderManagementController.prototype.confirmOrder);
    // NestJS RequestMethod: PATCH=4
    expect(method).toBe(4 /* RequestMethod.PATCH */);
    expect(path).toBe(':id/confirm');
  });
});

// ── Service: createOrder ──────────────────────────────────────────────────────

describe('OrderManagementService.createOrder', () => {
  it('persists a pending order with nested items and returns {id, status, customerId}', async () => {
    const { prisma, customers, vendors } = makePrisma();
    customers.push({ id: 'cust1', userId: 'user1' });
    vendors.push({ id: 'vend1', userId: 'vuser1' });

    const svc = makeService(prisma);
    const res = await svc.createOrder('user1', {
      vendorId: 'vend1',
      items: [{ description: 'Widget', quantity: 2, unitPrice: 9.99 }],
    });

    expect(res).toEqual({ id: 'ord1', status: 'pending', customerId: 'cust1' });
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending', customerId: 'cust1', vendorId: 'vend1' }),
      }),
    );
  });

  it('throws ConflictException when no Customer row for the user', async () => {
    const { prisma } = makePrisma();
    const svc = makeService(prisma);
    await expect(svc.createOrder('unknown', { vendorId: 'v1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws NotFoundException when vendor does not exist', async () => {
    const { prisma, customers } = makePrisma();
    customers.push({ id: 'cust1', userId: 'user1' });
    const svc = makeService(prisma);
    await expect(svc.createOrder('user1', { vendorId: 'nonexistent' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// ── Service: listOrders ───────────────────────────────────────────────────────

describe('OrderManagementService.listOrders', () => {
  it('filters by customerId for CUSTOMER role', async () => {
    const { prisma, customers, vendors, orders } = makePrisma();
    customers.push({ id: 'cust1', userId: 'user1' });
    customers.push({ id: 'cust2', userId: 'user2' });
    vendors.push({ id: 'vend1', userId: 'vuser1' });
    orders.push({ id: 'ord1', status: 'pending', customerId: 'cust1', vendorId: 'vend1', createdAt: new Date() });
    orders.push({ id: 'ord2', status: 'pending', customerId: 'cust2', vendorId: 'vend1', createdAt: new Date() });

    const svc = makeService(prisma);
    const res = await svc.listOrders('user1', 'CUSTOMER');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('ord1');
  });

  it('returns empty array for CUSTOMER with no Customer row', async () => {
    const { prisma } = makePrisma();
    const svc = makeService(prisma);
    const res = await svc.listOrders('unknown', 'CUSTOMER');
    expect(res).toEqual([]);
  });

  it('filters by vendorId for VENDOR role', async () => {
    const { prisma, customers, vendors, orders } = makePrisma();
    customers.push({ id: 'cust1', userId: 'user1' });
    vendors.push({ id: 'vend1', userId: 'vuser1' });
    vendors.push({ id: 'vend2', userId: 'vuser2' });
    orders.push({ id: 'ord1', status: 'pending', customerId: 'cust1', vendorId: 'vend1', createdAt: new Date() });
    orders.push({ id: 'ord2', status: 'pending', customerId: 'cust1', vendorId: 'vend2', createdAt: new Date() });

    const svc = makeService(prisma);
    const res = await svc.listOrders('vuser1', 'VENDOR');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('ord1');
  });

  it('returns empty array for VENDOR with no VendorProfile row', async () => {
    const { prisma } = makePrisma();
    const svc = makeService(prisma);
    const res = await svc.listOrders('unknown', 'VENDOR');
    expect(res).toEqual([]);
  });

  it('returns all orders for ADMIN role', async () => {
    const { prisma, customers, vendors, orders } = makePrisma();
    customers.push({ id: 'cust1', userId: 'user1' });
    vendors.push({ id: 'vend1', userId: 'vuser1' });
    orders.push({ id: 'ord1', status: 'pending', customerId: 'cust1', vendorId: 'vend1', createdAt: new Date() });
    orders.push({ id: 'ord2', status: 'confirmed', customerId: 'cust1', vendorId: 'vend1', createdAt: new Date() });

    const svc = makeService(prisma);
    const res = await svc.listOrders('admin1', 'ADMIN');
    expect(res).toHaveLength(2);
  });
});

// ── Service: confirmOrder ─────────────────────────────────────────────────────

describe('OrderManagementService.confirmOrder', () => {
  const futureDate = '2099-12-31';

  it('vendor confirms their own pending order and returns confirmed', async () => {
    const { prisma, customers, vendors, orders } = makePrisma();
    customers.push({ id: 'cust1', userId: 'user1' });
    vendors.push({ id: 'vend1', userId: 'vuser1' });
    orders.push({ id: 'ord1', status: 'pending', customerId: 'cust1', vendorId: 'vend1', createdAt: new Date() });

    const svc = makeService(prisma);
    const res = await svc.confirmOrder('ord1', 'vuser1', 'VENDOR', futureDate);
    expect(res).toEqual({ id: 'ord1', status: 'confirmed', estimatedDelivery: futureDate });
  });

  it("throws NotFoundException when vendor tries to confirm another vendor's order", async () => {
    const { prisma, customers, vendors, orders } = makePrisma();
    customers.push({ id: 'cust1', userId: 'user1' });
    vendors.push({ id: 'vend1', userId: 'vuser1' });
    vendors.push({ id: 'vend2', userId: 'vuser2' });
    orders.push({ id: 'ord1', status: 'pending', customerId: 'cust1', vendorId: 'vend1', createdAt: new Date() });

    const svc = makeService(prisma);
    await expect(svc.confirmOrder('ord1', 'vuser2', 'VENDOR', futureDate)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ConflictException for an already-confirmed order', async () => {
    const { prisma, customers, vendors, orders } = makePrisma();
    customers.push({ id: 'cust1', userId: 'user1' });
    vendors.push({ id: 'vend1', userId: 'vuser1' });
    orders.push({ id: 'ord1', status: 'confirmed', customerId: 'cust1', vendorId: 'vend1', createdAt: new Date() });

    const svc = makeService(prisma);
    await expect(svc.confirmOrder('ord1', 'vuser1', 'VENDOR', futureDate)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws NotFoundException for a non-existent order', async () => {
    const { prisma, vendors } = makePrisma();
    vendors.push({ id: 'vend1', userId: 'vuser1' });

    const svc = makeService(prisma);
    await expect(svc.confirmOrder('nonexistent', 'vuser1', 'VENDOR', futureDate)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// ── DTO: parseConfirmOrder ────────────────────────────────────────────────────

describe('parseConfirmOrder', () => {
  it('throws BadRequestException for a past date', async () => {
    const { parseConfirmOrder } = await import('./order-management.dto');
    expect(() => parseConfirmOrder({ estimatedDelivery: '2000-01-01' })).toThrow(BadRequestException);
  });

  it('throws BadRequestException for a non-date string', async () => {
    const { parseConfirmOrder } = await import('./order-management.dto');
    expect(() => parseConfirmOrder({ estimatedDelivery: 'not-a-date' })).toThrow(BadRequestException);
  });

  it('accepts a future date', async () => {
    const { parseConfirmOrder } = await import('./order-management.dto');
    expect(() => parseConfirmOrder({ estimatedDelivery: '2099-12-31' })).not.toThrow();
  });
});
