import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotificationPreferenceView {
  userId: string;
  orderAlerts: boolean;
  messageAlerts: boolean;
}

@Injectable()
export class NotificationPreferencesService extends FeatureService {
  constructor(private readonly db: PrismaService) {
    super(db, []);
  }

  private view(r: { userId: string; orderAlerts: boolean; messageAlerts: boolean }): NotificationPreferenceView {
    return { userId: r.userId, orderAlerts: r.orderAlerts, messageAlerts: r.messageAlerts };
  }

  async get(userId: string): Promise<NotificationPreferenceView> {
    const row = await this.db.notificationPreference.findUnique({ where: { userId } });
    return row ? this.view(row) : { userId, orderAlerts: false, messageAlerts: false };
  }

  async upsert(userId: string, orderAlerts: boolean, messageAlerts: boolean): Promise<NotificationPreferenceView> {
    const row = await this.db.notificationPreference.upsert({
      where: { userId },
      create: { userId, orderAlerts, messageAlerts },
      update: { orderAlerts, messageAlerts },
    });
    return this.view(row);
  }
}
