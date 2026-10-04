// AuditLog DTOs
import { z } from 'zod';

export const CreateAuditEntrySchema = z.object({
  action: z.string().trim().min(1).max(500),
  userId: z.string().trim().min(1),
});

export type CreateAuditEntryDto = z.infer<typeof CreateAuditEntrySchema>;

export interface GetApiAdminAuditLogRequestDto {}

export interface GetApiAdminAuditLogResponseDto {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
}

export interface PostApiAdminAuditLogRequestDto {
  action: string;
  userId: string;
}

export interface PostApiAdminAuditLogResponseDto {
  id: string;
  action: string;
  createdAt: string;
}
