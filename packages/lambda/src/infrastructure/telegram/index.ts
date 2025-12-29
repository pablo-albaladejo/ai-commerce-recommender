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

// Client
export {
  createTelegramClient,
  defaultTelegramClient,
  type TelegramClient,
  type SendMessageParams,
  type TelegramClientConfig,
} from './telegram-client';

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
