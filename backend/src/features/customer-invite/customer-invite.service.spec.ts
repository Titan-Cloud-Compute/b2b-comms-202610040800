import { BadRequestException, ConflictException } from '@nestjs/common';
import { CustomerInviteService } from './customer-invite.service';

function makePrisma(state: { customers: any[]; users: any[] }) {
  const tx = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => state.users.find((u) => u.email === where.email) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const u = { id: `u${state.users.length + 1}`, ...data };
        state.users.push(u);
        return u;
      }),
    },
    customer: {
      create: jest.fn(async ({ data }: any) => {
        const c = { id: `c${state.customers.length + 1}`, ...data };
        state.customers.push(c);
        return c;
      }),
    },
  };
  return {
    tx,
    customer: {
      findUnique: jest.fn(async ({ where }: any) => state.customers.find((c) => c.email === where.email) ?? null),
      findMany: jest.fn(async () => state.customers.map((c) => ({ id: c.id, email: c.email }))),
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
}

describe('CustomerInviteService', () => {
  it('creates User + Customer and returns invitationSent true', async () => {
    const state = { customers: [] as any[], users: [] as any[] };
    const prisma = makePrisma(state);
    const svc = new CustomerInviteService(prisma as any);
    const res = await svc.invite('Buyer@Corp.example.com');
    expect(res).toEqual({ customerId: 'c1', email: 'buyer@corp.example.com', invitationSent: true });
    expect(state.users[0]).toMatchObject({ email: 'buyer@corp.example.com', role: 'CUSTOMER' });
    expect(await svc.list()).toEqual([{ id: 'c1', email: 'buyer@corp.example.com' }]);
  });

  it('rejects a duplicate invite with 409', async () => {
    const state = { customers: [] as any[], users: [] as any[] };
    const svc = new CustomerInviteService(makePrisma(state) as any);
    await svc.invite('buyer@corp.example.com');
    await expect(svc.invite('buyer@corp.example.com')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an invalid email with 400', async () => {
    const svc = new CustomerInviteService(makePrisma({ customers: [], users: [] }) as any);
    await expect(svc.invite('not-an-email')).rejects.toBeInstanceOf(BadRequestException);
  });
});
