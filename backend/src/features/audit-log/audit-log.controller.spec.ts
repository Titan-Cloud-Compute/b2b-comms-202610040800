import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

const ENTRY_1 = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  action: 'login',
  userId: 'u1',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

const ENTRY_2 = {
  id: 'aaaaaaaa-0000-0000-0000-000000000002',
  action: 'logout',
  userId: 'u2',
  createdAt: new Date('2024-01-02T00:00:00.000Z'),
};

describe('AuditLog HTTP', () => {
  let app: INestApplication;
  let findMany: jest.Mock;
  let create: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([ENTRY_1, ENTRY_2]);
    create = jest.fn().mockResolvedValue({
      id: ENTRY_1.id,
      action: 'login',
      createdAt: ENTRY_1.createdAt,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: { auditEntry: { findMany, create } },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/admin/audit-log', () => {
    it('returns 200 with rows ordered by createdAt asc', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/audit-log')
        .expect(200);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
      );

      expect(res.body).toHaveLength(2);
      const keys = Object.keys(res.body[0]).sort();
      expect(keys).toEqual(['action', 'createdAt', 'id', 'userId'].sort());
    });
  });

  describe('POST /api/admin/audit-log', () => {
    it('returns 201 with id, action, createdAt', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/audit-log')
        .send({ action: 'login', userId: 'u1' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        action: 'login',
        createdAt: expect.any(String),
      });
    });

    it('returns 400 when action is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/audit-log')
        .send({})
        .expect(400);
    });
  });
});
