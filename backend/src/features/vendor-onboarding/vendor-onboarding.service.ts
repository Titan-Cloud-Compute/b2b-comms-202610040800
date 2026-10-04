import { BadRequestException, Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiVendorDocumentsResponseDto,
  PostApiVendorDocumentsResponseDto,
  PostApiVendorProfileRequestDto,
  PostApiVendorProfileResponseDto,
} from './vendor-onboarding.dto';

@Injectable()
export class VendorOnboardingService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['VendorProfile', 'Document']);
  }

  async upsertProfile(
    userId: string,
    input: PostApiVendorProfileRequestDto,
  ): Promise<PostApiVendorProfileResponseDto> {
    const profile = await this.model('VendorProfile').upsert({
      where: { userId },
      create: { userId, companyName: input.companyName, contactEmail: input.contactEmail },
      update: { companyName: input.companyName, contactEmail: input.contactEmail },
    });
    return { id: profile.id, companyName: profile.companyName, contactEmail: profile.contactEmail };
  }

  async createDocument(userId: string, filename: string): Promise<PostApiVendorDocumentsResponseDto> {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Submit your company profile before uploading documents');
    const doc = await this.model('Document').create({
      data: { filename, status: 'pending', vendorProfileId: profile.id },
    });
    return { id: doc.id, filename: doc.filename, status: doc.status };
  }

  async listDocuments(userId: string): Promise<GetApiVendorDocumentsResponseDto[]> {
    const profile = await this.model('VendorProfile').findUnique({ where: { userId } });
    if (!profile) return [];
    const docs = await this.model('Document').findMany({
      where: { vendorProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({ id: d.id, filename: d.filename, status: d.status }));
  }
}
