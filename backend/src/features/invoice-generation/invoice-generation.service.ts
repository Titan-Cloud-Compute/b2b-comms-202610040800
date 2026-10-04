import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../lib/integrations/minio.service';
import {
  GetApiInvoicesIdDownloadResponseDto,
  PostApiInvoicesRequestDto,
  PostApiInvoicesResponseDto,
} from './invoice-generation.dto';

export function invoiceObjectKey(id: string): string {
  return `invoices/${id}.txt`;
}

@Injectable()
export class InvoiceGenerationService extends FeatureService {
  constructor(prisma: PrismaService, private readonly minio: MinioService) {
    super(prisma, ['Invoice', 'Order'] as const);
  }

  async create(body: PostApiInvoicesRequestDto): Promise<PostApiInvoicesResponseDto> {
    const amount = Number(body?.amount);
    if (!body || typeof body.orderId !== 'string' || !body.orderId || !Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('orderId and a non-negative amount are required');
    }
    const order = await this.model('Order').findUnique({ where: { id: body.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (String(order.status).toLowerCase() !== 'confirmed') {
      throw new BadRequestException('Invoices can only be generated for confirmed orders');
    }
    const existing = await this.model('Invoice').findUnique({ where: { orderId: order.id } });
    if (existing) throw new ConflictException('An invoice already exists for this order');

    const invoice = await this.model('Invoice').create({ data: { orderId: order.id, amount } });
    const content = Buffer.from(
      `Invoice ${invoice.id}\nOrder: ${invoice.orderId}\nAmount: ${invoice.amount}\nDate: ${invoice.createdAt.toISOString()}\n`,
      'utf8',
    );
    await this.minio.putObject(invoiceObjectKey(invoice.id), content, content.length, 'text/plain');
    return { id: invoice.id, orderId: invoice.orderId, amount: invoice.amount };
  }

  async download(id: string): Promise<GetApiInvoicesIdDownloadResponseDto> {
    const invoice = await this.model('Invoice').findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const downloadUrl = await this.minio.getSignedUrl(invoiceObjectKey(invoice.id));
    return { id: invoice.id, downloadUrl };
  }
}
