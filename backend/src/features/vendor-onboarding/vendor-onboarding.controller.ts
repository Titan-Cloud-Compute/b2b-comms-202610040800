import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { VendorOnboardingService } from './vendor-onboarding.service';
import type {
  GetApiVendorDocumentsResponseDto,
  PostApiVendorDocumentsRequestDto,
  PostApiVendorDocumentsResponseDto,
  PostApiVendorProfileRequestDto,
  PostApiVendorProfileResponseDto,
} from './vendor-onboarding.dto';

function sessionUserId(req: Request): string {
  const userId = req.session?.userId;
  if (!userId) throw new UnauthorizedException();
  return userId;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
}

@ApiTags('vendor-onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@Controller('api/vendor')
export class VendorOnboardingController {
  constructor(private readonly vendoronboarding: VendorOnboardingService) {}

  @Post('profile')
  @HttpCode(201)
  async postApiVendorProfile(
    @Req() req: Request,
    @Body() body: PostApiVendorProfileRequestDto,
  ): Promise<PostApiVendorProfileResponseDto> {
    return this.vendoronboarding.upsertProfile(sessionUserId(req), {
      companyName: requireString(body?.companyName, 'companyName'),
      contactEmail: requireString(body?.contactEmail, 'contactEmail'),
    });
  }

  @Post('documents')
  @HttpCode(201)
  async postApiVendorDocuments(
    @Req() req: Request,
    @Body() body: PostApiVendorDocumentsRequestDto,
  ): Promise<PostApiVendorDocumentsResponseDto> {
    return this.vendoronboarding.createDocument(sessionUserId(req), requireString(body?.filename, 'filename'));
  }

  @Get('documents')
  async getApiVendorDocuments(@Req() req: Request): Promise<GetApiVendorDocumentsResponseDto[]> {
    return this.vendoronboarding.listDocuments(sessionUserId(req));
  }
}
