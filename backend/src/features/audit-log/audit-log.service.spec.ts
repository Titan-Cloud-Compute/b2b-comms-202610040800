import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

function makePrisma() {
  return {
    auditEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
}

describe('AuditLogService', () => {
  it('lists entries in chronological order', async () => {
    const prisma = makePrisma();
    prisma.auditEntry.findMany.mockResolvedValue([
      { id: 'a', action: 'login', userId: 'u1', createdAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'b', action: 'logout', userId: 'u1', createdAt: new Date('2026-01-02T00:00:00Z') },
    ]);
    const svc = new AuditLogService(prisma as unknown as PrismaService);
    const res = await svc.list();
    expect(prisma.auditEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
    expect(res.map(r => r.id)).toEqual(['a', 'b']);
    expect(res[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('creates and returns the stored record', async () => {
    const prisma = makePrisma();
    prisma.auditEntry.create.mockResolvedValue({
      id: 'c', action: 'export', userId: 'u2', createdAt: new Date('2026-02-01T00:00:00Z'),
    });
    const svc = new AuditLogService(prisma as unknown as PrismaService);
    const res = await svc.create({ action: 'export', userId: 'u2' });
    expect(prisma.auditEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { action: 'export', userId: 'u2' } }),
    );
    expect(res).toEqual({ id: 'c', action: 'export', userId: 'u2', createdAt: '2026-02-01T00:00:00.000Z' });
  });

  it('rejects a missing action', async () => {
    const svc = new AuditLogService(makePrisma() as unknown as PrismaService);
    await expect(svc.create({ action: '', userId: 'u2' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AuditLogController', () => {
  it('routes GET and POST /api/admin/audit-log to the service', async () => {
    const svc = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'x', action: 'a', userId: 'u', createdAt: 't' }),
    };
    const ctrl = new AuditLogController(svc as unknown as AuditLogService);
    expect(Reflect.getMetadata('path', AuditLogController)).toBe('api/admin/audit-log');
    await expect(ctrl.getApiAdminAuditLog()).resolves.toEqual([]);
    await expect(ctrl.postApiAdminAuditLog({ action: 'a', userId: 'u' })).resolves.toMatchObject({ id: 'x' });
  });
});
