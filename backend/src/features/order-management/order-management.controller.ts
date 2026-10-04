import { Body, Controller, HttpCode, Param, Req, UnauthorizedException, UseGuards, Post, Patch, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { OrderActor, OrderManagementService } from './order-management.service';
import type {
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmRequestDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersRequestDto,
  PostApiOrdersResponseDto,
} from './order-management.dto';

function actorOf(req: Request): OrderActor {
  const s = req.session;
  if (!s?.userId) throw new UnauthorizedException();
  return { userId: s.userId, role: String(s.role) };
}

@ApiTags('order-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.ADMIN)
@Controller('api/orders')
export class OrderManagementController {
  constructor(private readonly ordermanagement: OrderManagementService) {}

  @Post()
  @HttpCode(201)
  @Roles(UserRole.CUSTOMER)
  async postApiOrders(
    @Req() req: Request,
    @Body() body: PostApiOrdersRequestDto,
  ): Promise<PostApiOrdersResponseDto> {
    return this.ordermanagement.create(actorOf(req), body?.vendorId, body?.items ?? []);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async patchApiOrdersIdConfirm(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: PatchApiOrdersIdConfirmRequestDto,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    return this.ordermanagement.confirm(actorOf(req), id, body?.estimatedDelivery);
  }

  @Get()
  async getApiOrders(@Req() req: Request): Promise<GetApiOrdersResponseDto[]> {
    return this.ordermanagement.list(actorOf(req));
  }
}
