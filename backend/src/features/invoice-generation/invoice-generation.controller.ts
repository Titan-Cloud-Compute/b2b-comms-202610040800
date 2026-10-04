import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { InvoiceGenerationService } from './invoice-generation.service';
import {
  GetApiInvoicesIdDownloadResponseDto,
  PostApiInvoicesRequestDto,
  PostApiInvoicesResponseDto,
} from './invoice-generation.dto';

@ApiTags('invoice-generation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/invoices')
export class InvoiceGenerationController {
  constructor(private readonly invoicegeneration: InvoiceGenerationService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  @HttpCode(HttpStatus.CREATED)
  async postApiInvoices(@Body() body: PostApiInvoicesRequestDto): Promise<PostApiInvoicesResponseDto> {
    return this.invoicegeneration.create(body);
  }

  @Get(':id/download')
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  async getApiInvoicesIdDownload(@Param('id') id: string): Promise<GetApiInvoicesIdDownloadResponseDto> {
    return this.invoicegeneration.download(id);
  }
}
