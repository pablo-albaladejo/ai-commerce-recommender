// Schemas & Types
export {
  TelegramUpdateSchema,
  TelegramMessageSchema,
  TelegramUserSchema,
  TelegramChatSchema,
  type TelegramUpdate,
  type TelegramMessage,
  type TelegramUser,
  type TelegramChat,
} from './telegram-schemas';

// Client (re-exported from shared)
export {
  getTelegramClient,
  resetTelegramClient,
  type TelegramClient,
  type SendMessageParams,
  type GetTelegramClientParams,
} from '../shared/telegram-client';

// Utilities
export {
  parseTelegramUpdate,
  getChatIdFromUpdate,
  getUserIdFromUpdate,
  // Legacy
  extractTelegramData,
  extractUserId,
  extractChatId,
  isTextMessage,
  truncateText,
  validateMessageLength,
  type TelegramEventData,
} from './telegram-utils';
