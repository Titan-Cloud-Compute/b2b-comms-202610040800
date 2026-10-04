import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import {
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersResponseDto,
  parseConfirmOrder,
  parseCreateOrder,
} from './order-management.dto';
import { OrderManagementService } from './order-management.service';

@ApiTags('order-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/orders')
export class OrderManagementController {
  constructor(private readonly ordermanagement: OrderManagementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async createOrder(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<PostApiOrdersResponseDto> {
    const dto = parseCreateOrder(body);
    const userId = req.session!.userId;
    return this.ordermanagement.createOrder(userId, dto);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.ADMIN)
  async listOrders(@Req() req: Request): Promise<GetApiOrdersResponseDto[]> {
    const { userId, role } = req.session!;
    return this.ordermanagement.listOrders(userId, role);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async confirmOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    const dto = parseConfirmOrder(body);
    const { userId, role } = req.session!;
    return this.ordermanagement.confirmOrder(id, userId, role, dto.estimatedDelivery);
  }
}
