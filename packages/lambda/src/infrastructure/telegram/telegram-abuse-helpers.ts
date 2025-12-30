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
import type { AbuseProtectionDependencies } from '../../middleware/abuse-protection/abuse-protection';
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
// Complete Abuse Protection Factory for Telegram
// ============================================================================

export type CounterServices = {
  checkRateLimit: CheckRateLimit;
  checkDailyCounter: CheckDailyCounter;
  recordTokenUsage: RecordTokenUsage;
};

/**
 * Creates all dependencies needed for abuseProtectionMiddleware with Telegram.
 * Includes extractors and counter services.
 *
 * This factory does NOT send messages directly. If you want user notifications,
 * let the handler decide by wiring a `notifyUser` function into the error handler.
 *
 * @example
 * const abuseProtection = abuseProtectionMiddleware(
 *   createTelegramAbuseProtection(counterServices)
 * );
 */
export const createTelegramAbuseProtection = (
  counterServices: CounterServices
): AbuseProtectionDependencies => ({
  // Counter services
  checkRateLimit: counterServices.checkRateLimit,
  checkDailyQuota: counterServices.checkDailyCounter,
  recordTokenUsage: counterServices.recordTokenUsage,
  // Telegram extractors
  extractChatId: getChatIdFromUpdate,
  extractUserId: getUserIdFromUpdate,
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
