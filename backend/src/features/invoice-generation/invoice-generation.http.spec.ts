import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../lib/integrations/minio.service';
import { InvoiceGenerationController } from './invoice-generation.controller';
import { InvoiceGenerationService } from './invoice-generation.service';

/** Fake auth: role comes from the x-test-role header (no cookie/JWT needed). */
class FakeJwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.session = {
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'test@example.com',
      role: req.headers['x-test-role'] ?? 'VENDOR',
    };
    return true;
  }
}

describe('InvoiceGeneration HTTP', () => {
  let app: INestApplication;
  const orders: Record<string, { id: string; status: string }> = {
    'order-confirmed': { id: 'order-confirmed', status: 'confirmed' },
    'order-pending': { id: 'order-pending', status: 'pending' },
  };
  let invoices: Array<{ id: string; orderId: string; amount: number; createdAt: Date }>;

  const prisma = {
    order: { findUnique: jest.fn(async ({ where }: any) => orders[where.id] ?? null) },
    invoice: {
      findUnique: jest.fn(
        async ({ where }: any) =>
          invoices.find((i) => (where.id ? i.id === where.id : i.orderId === where.orderId)) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const inv = { id: `inv-${invoices.length + 1}`, createdAt: new Date(), ...data };
        invoices.push(inv);
        return inv;
      }),
    },
  };
  const minio = {
    putObject: jest.fn(async (key: string) => ({ etag: 'e', bucket: 'b', key })),
    getSignedUrl: jest.fn(async (key: string) => `https://minio.example/b/${key}?sig=1`),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InvoiceGenerationController],
      providers: [
        InvoiceGenerationService,
        { provide: PrismaService, useValue: prisma },
        { provide: MinioService, useValue: minio },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeJwtGuard)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    invoices = [];
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('vendor generates an invoice for a confirmed order → 201 with id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('x-test-role', 'VENDOR')
      .send({ orderId: 'order-confirmed', amount: 125.5 })
      .expect(201);
    expect(res.body).toEqual({ id: 'inv-1', orderId: 'order-confirmed', amount: 125.5 });
    expect(minio.putObject).toHaveBeenCalledWith('invoices/inv-1.txt', expect.any(Buffer), expect.any(Number), 'text/plain');
  });

  it('rejects invoices for unconfirmed orders', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('x-test-role', 'VENDOR')
      .send({ orderId: 'order-pending', amount: 10 })
      .expect(400);
  });

  it('customer cannot generate invoices', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('x-test-role', 'CUSTOMER')
      .send({ orderId: 'order-confirmed', amount: 10 })
      .expect(403);
  });

  it('customer downloads invoice → 200 with downloadUrl', async () => {
    invoices.push({ id: 'inv-9', orderId: 'order-confirmed', amount: 5, createdAt: new Date() });
    const res = await request(app.getHttpServer())
      .get('/api/invoices/inv-9/download')
      .set('x-test-role', 'CUSTOMER')
      .expect(200);
    expect(res.body.id).toBe('inv-9');
    expect(res.body.downloadUrl).toContain('invoices/inv-9.txt');
  });

  it('download of unknown invoice → 404', async () => {
    await request(app.getHttpServer())
      .get('/api/invoices/missing/download')
      .set('x-test-role', 'CUSTOMER')
      .expect(404);
  });
});
