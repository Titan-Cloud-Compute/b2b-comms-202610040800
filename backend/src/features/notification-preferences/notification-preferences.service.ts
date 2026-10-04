import { Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationPreferencesService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, []);
  }
}
