import { z } from 'zod';

// ============================================================================
// Telegram API Schemas
// ============================================================================

export const TelegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

export const TelegramChatSchema = z.object({
  id: z.number(),
  type: z.enum(['private', 'group', 'supergroup', 'channel']),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export type TelegramMessage = {
  message_id: number;
  from?: z.infer<typeof TelegramUserSchema>;
  date: number;
  chat: z.infer<typeof TelegramChatSchema>;
  text?: string;
  entities?: unknown[];
  reply_to_message?: TelegramMessage;
};

export const TelegramMessageSchema: z.ZodType<TelegramMessage> = z.object({
  message_id: z.number(),
  from: TelegramUserSchema.optional(),
  date: z.number(),
  chat: TelegramChatSchema,
  text: z.string().optional(),
  entities: z.array(z.unknown()).optional(),
  reply_to_message: z.lazy(() => TelegramMessageSchema).optional(),
});

export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: TelegramMessageSchema.optional(),
  edited_message: TelegramMessageSchema.optional(),
  channel_post: TelegramMessageSchema.optional(),
  edited_channel_post: TelegramMessageSchema.optional(),
  callback_query: z.unknown().optional(),
});

export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
export type TelegramUser = z.infer<typeof TelegramUserSchema>;
export type TelegramChat = z.infer<typeof TelegramChatSchema>;
