/**
 * Utility functions for Telegram webhook processing
 */

import { TelegramUpdate, TelegramUpdateSchema } from './telegram-schemas';

// Re-export schemas and types
export { TelegramUpdate, TelegramUpdateSchema } from './telegram-schemas';
export type {
  TelegramChat,
  TelegramMessage,
  TelegramUser,
} from './telegram-schemas';

// ============================================================================
// Parsed Event Extractors (for use after parser middleware)
// ============================================================================

/**
 * Parse event using zod schema (no casts needed)
 */
export const parseTelegramUpdate = (event: unknown): TelegramUpdate | null => {
  const result = TelegramUpdateSchema.safeParse(event);
  return result.success ? result.data : null;
};

/**
 * Extract chatId from parsed TelegramUpdate
 */
export const getChatIdFromUpdate = (event: unknown): string | undefined => {
  const parsed = parseTelegramUpdate(event);
  if (!parsed) return undefined;
  const chatId = parsed.message?.chat?.id || parsed.edited_message?.chat?.id;
  return chatId?.toString();
};

/**
 * Extract userId from parsed TelegramUpdate
 */
export const getUserIdFromUpdate = (event: unknown): number | undefined => {
  const parsed = parseTelegramUpdate(event);
  if (!parsed) return undefined;
  return parsed.message?.from?.id || parsed.edited_message?.from?.id;
};

/**
 * Extract language code from parsed TelegramUpdate.
 * Used for i18n middleware configuration.
 */
export const getLocaleFromUpdate = (event: unknown): string | undefined => {
  const parsed = parseTelegramUpdate(event);
  if (!parsed) return undefined;
  return (
    parsed.message?.from?.language_code ||
    parsed.edited_message?.from?.language_code
  );
};

// ============================================================================
// Legacy Event Extractors (for raw API Gateway events with body)
// ============================================================================

export type TelegramEventData = {
  userId: number;
  chatId: number;
  messageText: string;
  messageId: number;
  username?: string;
  firstName?: string;
};

export type TelegramEvent = { body?: string | Record<string, unknown> };
type TelegramBody = {
  message?: {
    from?: { id: number; username?: string; first_name?: string };
    chat?: { id: number };
    text?: string;
    message_id?: number;
  };
  callback_query?: {
    from?: { id: number; username?: string; first_name?: string };
    message?: { chat?: { id: number }; message_id?: number };
  };
};

export const parseTelegramBody = (
  event: TelegramEvent
): TelegramBody | null => {
  if (!event.body) return null;
  if (typeof event.body !== 'string') return event.body;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
};

export const extractUserId = (event: TelegramEvent): number => {
  const body = parseTelegramBody(event);
  return body?.message?.from?.id || body?.callback_query?.from?.id || 0;
};

export const extractChatId = (event: TelegramEvent): number => {
  const body = parseTelegramBody(event);
  return (
    body?.message?.chat?.id || body?.callback_query?.message?.chat?.id || 0
  );
};

const extractFrom = (body: TelegramBody) =>
  body.message?.from || body.callback_query?.from;

const extractMessage = (body: TelegramBody) =>
  body.message || body.callback_query?.message;

const buildTelegramData = (
  body: TelegramBody,
  message: NonNullable<ReturnType<typeof extractMessage>>,
  from: ReturnType<typeof extractFrom>
): TelegramEventData => ({
  userId: from?.id || 0,
  chatId: message.chat?.id || 0,
  messageText: body.message?.text || '',
  messageId: message.message_id || 0,
  username: from?.username,
  firstName: from?.first_name,
});

export const extractTelegramData = (
  event: TelegramEvent
): TelegramEventData | null => {
  const body = parseTelegramBody(event);
  const message = body && extractMessage(body);
  return message ? buildTelegramData(body, message, extractFrom(body)) : null;
};

export const isTextMessage = (event: TelegramEvent): boolean => {
  const body = parseTelegramBody(event);
  return !!body?.message?.text;
};

/**
 * Truncate text to a maximum length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Validate message length (max 1500 chars per requirements)
 */
export const validateMessageLength = (
  text: string,
  maxLength = 1500
): { valid: boolean; truncated?: string } => {
  if (text.length <= maxLength) {
    return { valid: true };
  }
  return {
    valid: false,
    truncated: truncateText(text, maxLength),
  };
};
