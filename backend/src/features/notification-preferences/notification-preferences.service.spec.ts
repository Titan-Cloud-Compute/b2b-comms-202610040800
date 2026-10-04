import { NotificationPreferencesService } from './notification-preferences.service';

function makePrisma() {
  const rows = new Map<string, any>();
  return {
    notificationPreference: {
      findUnique: jest.fn(async ({ where }: any) => rows.get(where.userId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = rows.get(where.userId);
        const row = existing ? { ...existing, ...update } : { id: 'np-1', ...create };
        rows.set(where.userId, row);
        return row;
      }),
    },
  };
}

describe('NotificationPreferencesService', () => {
  it('upserts and returns the stored record', async () => {
    const svc = new NotificationPreferencesService(makePrisma() as any);
    const res = await svc.upsert('u1', true, false);
    expect(res).toEqual({ userId: 'u1', orderAlerts: true, messageAlerts: false });
    expect(await svc.get('u1')).toEqual(res);
  });

  it('stores both alert fields as false', async () => {
    const svc = new NotificationPreferencesService(makePrisma() as any);
    await svc.upsert('u1', true, true);
    const res = await svc.upsert('u1', false, false);
    expect(res).toEqual({ userId: 'u1', orderAlerts: false, messageAlerts: false });
  });
});
