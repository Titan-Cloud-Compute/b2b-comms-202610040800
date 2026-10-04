import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { VendorOnboardingController } from './vendor-onboarding.controller';
import { VendorOnboardingService } from './vendor-onboarding.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';

class FakeSessionGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.session = { userId: USER_ID, role: 'VENDOR', firmId: null };
    return true;
  }
}

function makeFakePrisma() {
  const profiles: any[] = [];
  const documents: any[] = [];
  return {
    vendorProfile: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = profiles.find((p) => p.userId === where.userId);
        if (existing) return Object.assign(existing, update);
        const row = { id: `vp-${profiles.length + 1}`, ...create };
        profiles.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => profiles.find((p) => p.userId === where.userId) ?? null),
    },
    document: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `doc-${documents.length + 1}`, createdAt: new Date(), ...data };
        documents.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        documents.filter((d) => d.vendorProfileId === where.vendorProfileId),
      ),
    },
  };
}

describe('VendorOnboarding HTTP', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VendorOnboardingController],
      providers: [VendorOnboardingService, { provide: PrismaService, useValue: makeFakePrisma() }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeSessionGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/vendor/profile returns 201 with the created VendorProfile', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/vendor/profile')
      .send({ companyName: 'Acme', contactEmail: 'ops@acme.example.com' })
      .expect(201);
    expect(res.body).toEqual({ id: expect.any(String), companyName: 'Acme', contactEmail: 'ops@acme.example.com' });
  });

  it('POST /api/vendor/profile rejects missing fields', async () => {
    await request(app.getHttpServer()).post('/api/vendor/profile').send({ companyName: 'Acme' }).expect(400);
  });

  it('uploads a document as pending and lists it in the library', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/vendor/profile')
      .send({ companyName: 'Acme', contactEmail: 'ops@acme.example.com' })
      .expect(201);
    const created = await request(server).post('/api/vendor/documents').send({ filename: 'w9.pdf' }).expect(201);
    expect(created.body).toEqual({ id: expect.any(String), filename: 'w9.pdf', status: 'pending' });

    const list = await request(server).get('/api/vendor/documents').expect(200);
    expect(list.body).toEqual([{ id: created.body.id, filename: 'w9.pdf', status: 'pending' }]);
  });

  it('GET /api/vendor/documents returns an empty list before a profile exists', async () => {
    const res = await request(app.getHttpServer()).get('/api/vendor/documents').expect(200);
    expect(res.body).toEqual([]);
  });
});
