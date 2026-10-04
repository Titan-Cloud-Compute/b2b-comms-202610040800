// SharedChannel DTOs with Zod validation schemas

import { z } from 'zod';

export const CreateChannelSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const PostMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export interface PostApiChannelsRequestDto {
  name: string;
}

export interface PostApiChannelsResponseDto {
  id: string;
  name: string;
}

export interface PostApiChannelsIdMessagesRequestDto {
  body: string;
}

export interface PostApiChannelsIdMessagesResponseDto {
  id: string;
  body: string;
  channelId: string;
}

export interface GetApiChannelsResponseDto {
  id: string;
  name: string;
}
