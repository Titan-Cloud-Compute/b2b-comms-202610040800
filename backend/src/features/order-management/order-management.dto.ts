// OrderManagement DTOs

import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

// ── Request / Response interfaces ────────────────────────────────────────────

export interface PostApiOrdersRequestDto {
  vendorId: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface PostApiOrdersResponseDto {
  id: string;
  status: string;
  customerId: string;
}

export interface PatchApiOrdersIdConfirmRequestDto {
  estimatedDelivery: string;
}

export interface PatchApiOrdersIdConfirmResponseDto {
  id: string;
  status: string;
  estimatedDelivery: string;
}

export interface GetApiOrdersResponseDto {
  id: string;
  status: string;
  vendorId: string;
  customerId: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

// ── Zod validation schemas ────────────────────────────────────────────────────

const OrderItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1)
    .max(200),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(10000),
  unitPrice: z
    .number()
    .min(0),
});

export const CreateOrderSchema = z.object({
  vendorId: z.string().trim().min(1),
  items: z.array(OrderItemSchema).max(100).optional(),
});

export function parseCreateOrder(body: unknown): PostApiOrdersRequestDto {
  const result = CreateOrderSchema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(result.error.errors[0]?.message ?? 'Invalid request body');
  }
  return result.data as PostApiOrdersRequestDto;
}

export const ConfirmOrderSchema = z.object({
  estimatedDelivery: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'estimatedDelivery must be a yyyy-mm-dd date')
    .refine((s) => {
      const d = new Date(s + 'T00:00:00Z');
      // Must be a real date
      if (isNaN(d.getTime())) return false;
      // Must not be before today (UTC)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return d >= today;
    }, 'estimatedDelivery must be today or in the future'),
});

export function parseConfirmOrder(body: unknown): PatchApiOrdersIdConfirmRequestDto {
  const result = ConfirmOrderSchema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(result.error.errors[0]?.message ?? 'Invalid request body');
  }
  return result.data as PatchApiOrdersIdConfirmRequestDto;
}
