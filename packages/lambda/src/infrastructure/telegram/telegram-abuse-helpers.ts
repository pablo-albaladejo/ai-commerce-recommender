/**
 * Telegram-specific helpers for middleware composition
 */

import type {
  AddConversationMessage,
  GetConversationContext,
} from '../../application/services/conversation-service';
import type {
  CheckDailyCounter,
  CheckRateLimit,
  RecordTokenUsage,
} from '../../application/services/counter-service';
import type {
  GetSecretToken,
  ValidateSignature,
} from '../../application/services/signature-service';
import type {
  AbuseProtectionDependencies,
  OnDailyQuotaExceeded,
  OnRateLimitExceeded,
  OnTokenBudgetExceeded,
} from '../../middleware/abuse-protection/abuse-protection';
import type { TelegramClient } from '../shared/telegram-client';
import { getChatIdFromUpdate, getUserIdFromUpdate } from './telegram-utils';

// Re-export extractors for convenience
export { getChatIdFromUpdate, getUserIdFromUpdate };

/**
 * Converts string chatId to number (for APIs that require number)
 */
export const getChatIdAsNumber = (event: unknown): number | undefined => {
  const chatId = getChatIdFromUpdate(event);
  if (!chatId) return undefined;
  const parsed = parseInt(chatId, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

// ============================================================================
// Default Abuse Protection Messages
// ============================================================================

const DEFAULT_MESSAGES = {
  rateLimit: (seconds: number) =>
    `⏳ Estás enviando mensajes muy rápido. Por favor espera ${seconds} segundos antes de continuar.`,
  dailyQuota:
    '📊 Has alcanzado tu límite diario de mensajes. Vuelve mañana para continuar. ¡Gracias por usar el servicio!',
  tokenBudget:
    '💰 Has agotado tu presupuesto de tokens por hoy. Vuelve mañana para continuar.',
};

// ============================================================================
// Notification Factory
// ============================================================================

export type AbuseNotificationCallbacks = {
  onRateLimitExceeded: OnRateLimitExceeded;
  onDailyQuotaExceeded: OnDailyQuotaExceeded;
  onTokenBudgetExceeded: OnTokenBudgetExceeded;
};

/**
 * Creates abuse protection notification callbacks for Telegram.
 * These callbacks send user-friendly messages when limits are exceeded.
 *
 * @param client - Telegram client instance
 * @param messages - Optional custom messages (uses defaults if not provided)
 */
export const createTelegramAbuseNotifications = (
  client: TelegramClient,
  messages?: Partial<{
    rateLimit: (seconds: number) => string;
    dailyQuota: string;
    tokenBudget: string;
  }>
): AbuseNotificationCallbacks => ({
  onRateLimitExceeded: async (chatId, info) => {
    const seconds = info.retryAfter ?? 60;
    const text = messages?.rateLimit
      ? messages.rateLimit(seconds)
      : DEFAULT_MESSAGES.rateLimit(seconds);
    await client.sendMessage({ chatId: parseInt(chatId, 10), text });
  },

  onDailyQuotaExceeded: async userId => {
    const text = messages?.dailyQuota ?? DEFAULT_MESSAGES.dailyQuota;
    await client.sendMessage({ chatId: userId, text });
  },

  onTokenBudgetExceeded: async userId => {
    const text = messages?.tokenBudget ?? DEFAULT_MESSAGES.tokenBudget;
    await client.sendMessage({ chatId: userId, text });
  },
});

// ============================================================================
// Complete Abuse Protection Factory for Telegram
// ============================================================================

export type CounterServices = {
  checkRateLimit: CheckRateLimit;
  checkDailyCounter: CheckDailyCounter;
  recordTokenUsage: RecordTokenUsage;
};

export type TelegramAbuseProtectionOptions = {
  messages?: Partial<{
    rateLimit: (seconds: number) => string;
    dailyQuota: string;
    tokenBudget: string;
  }>;
};

/**
 * Creates all dependencies needed for abuseProtectionMiddleware with Telegram.
 * Includes extractors, counter services, and notification callbacks.
 *
 * @example
 * const abuseProtection = abuseProtectionMiddleware(
 *   createTelegramAbuseProtection(telegramClient, counterServices)
 * );
 */
export const createTelegramAbuseProtection = (
  client: TelegramClient,
  counterServices: CounterServices,
  options?: TelegramAbuseProtectionOptions
): AbuseProtectionDependencies => ({
  // Counter services
  checkRateLimit: counterServices.checkRateLimit,
  checkDailyQuota: counterServices.checkDailyCounter,
  recordTokenUsage: counterServices.recordTokenUsage,
  // Telegram extractors
  extractChatId: getChatIdFromUpdate,
  extractUserId: getUserIdFromUpdate,
  // Notification callbacks
  ...createTelegramAbuseNotifications(client, options?.messages),
});

// ============================================================================
// Signature Validation Factory for Telegram
// ============================================================================

export type SignatureServices = {
  getSecretToken: GetSecretToken;
  validateSignature: ValidateSignature;
};

/**
 * Creates dependencies for signatureValidationMiddleware with Telegram defaults.
 *
 * @example
 * const signatureValidation = signatureValidationMiddleware(
 *   createTelegramSignatureValidation(signatureServices)
 * );
 */
export const createTelegramSignatureValidation = (
  services: SignatureServices
) => ({
  getSecretToken: services.getSecretToken,
  validateSignature: services.validateSignature,
});

// ============================================================================
// Context Manager Factory for Telegram
// ============================================================================

export type ConversationServices = {
  getContext: GetConversationContext;
  addMessage: AddConversationMessage;
};

/**
 * Creates dependencies for contextManagerMiddleware with Telegram extractors.
 *
 * @example
 * const contextManager = contextManagerMiddleware(
 *   createTelegramContextManager(conversationServices)
 * );
 */
export const createTelegramContextManager = (
  services: ConversationServices
) => ({
  getContext: services.getContext,
  addMessage: services.addMessage,
  extractUserId: getUserIdFromUpdate,
  extractChatId: getChatIdAsNumber,
});

// ============================================================================
// Error Handler Factory
// ============================================================================

import type { Logger } from '@aws-lambda-powertools/logger';
import type { Metrics } from '@aws-lambda-powertools/metrics';

export type Powertools = {
  logger: Logger;
  metrics: Metrics;
};

/**
 * Creates dependencies for errorHandlerMiddleware.
 *
 * @example
 * const errorHandler = errorHandlerMiddleware(
 *   createErrorHandlerDeps(powertools)
 * );
 */
export const createErrorHandlerDeps = (powertools: Powertools) => ({
  logger: powertools.logger,
  metrics: powertools.metrics,
});
