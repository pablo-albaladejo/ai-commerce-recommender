import { ApiGatewayV2Envelope } from '@aws-lambda-powertools/parser/envelopes';
import { parser } from '@aws-lambda-powertools/parser/middleware';
import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import type { ChatResponse } from '../../application/services/send-chat-response';
import { processChatMessage } from '../../application/use-cases/process-chat-message';
import { defaultPowertools } from '../../infrastructure/config/powertools-factory';
import { getDynamoDBClient } from '../../infrastructure/database/dynamodb-client';
import { composeConversationServices } from '../../infrastructure/services/compose-conversation-services';
import { composeCounterServices } from '../../infrastructure/services/compose-counter-services';
import { sendTelegramResponseService } from '../../infrastructure/services/send-telegram-response-service';
import {
  getSecretToken,
  validateSignature,
} from '../../infrastructure/services/signature-validation-service';
import { getTelegramClient } from '../../infrastructure/shared/telegram-client';
import {
  TelegramMessage,
  TelegramUpdate,
  TelegramUpdateSchema,
} from '../../infrastructure/telegram/telegram-schemas';
import {
  getChatIdFromUpdate,
  getUserIdFromUpdate,
} from '../../infrastructure/telegram/telegram-utils';
import { abuseProtectionMiddleware } from '../../middleware/abuse-protection/abuse-protection';
import { contextManagerMiddleware } from '../../middleware/context/context-manager';
import { errorHandlerMiddleware } from '../../middleware/observability/error-handler';
import { tracingMiddleware } from '../../middleware/observability/tracing';
import { signatureValidationMiddleware } from '../../middleware/security/signature-validation';
import { httpResponse } from '../../shared/http-response';

// ============================================================================
// Types
// ============================================================================

// After parser middleware, the event IS the TelegramUpdate directly
export type TelegramWebhookEvent = TelegramUpdate & {
  context?: {
    trace?: {
      traceId?: string;
    };
  };
};

// ============================================================================
// Configuration
// ============================================================================

const tables = {
  rateLimit: process.env.QUOTAS_TABLE_NAME || 'rate-limits',
  dailyQuota: process.env.QUOTAS_TABLE_NAME || 'daily-quotas',
  tokenBudget: process.env.BUDGETS_TABLE_NAME || 'token-budgets',
  conversationContext:
    process.env.CONVERSATION_CONTEXT_TABLE_NAME || 'conversation-contexts',
};

// ============================================================================
// Infrastructure Composition
// ============================================================================

const dynamoClient = getDynamoDBClient();
const { logger, metrics } = defaultPowertools;

// Telegram client singleton (config from environment)
const telegramClient = getTelegramClient({
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  logger,
});

// Services composed with injected dependencies
const counterServices = composeCounterServices(dynamoClient);
const conversationServices = composeConversationServices(
  dynamoClient,
  {
    tableName: tables.conversationContext,
    maxMessages: 6,
  },
  logger
);
const sendTelegramResponse = sendTelegramResponseService(
  telegramClient,
  logger
);

// ============================================================================
// Middleware Composition
// ============================================================================

const abuseProtection = abuseProtectionMiddleware({
  checkRateLimit: counterServices.checkRateLimit,
  checkDailyQuota: counterServices.checkDailyCounter,
  recordTokenUsage: counterServices.recordTokenUsage,
  extractChatId: getChatIdFromUpdate,
  extractUserId: getUserIdFromUpdate,
});

const signatureValidation = signatureValidationMiddleware({
  getSecretToken,
  validateSignature,
});

const contextManager = contextManagerMiddleware({
  getContext: conversationServices.getContext,
  addMessage: conversationServices.addMessage,
  extractUserId: getUserIdFromUpdate,
  extractChatId: event => {
    const chatId = getChatIdFromUpdate(event);
    if (!chatId) return undefined;
    const parsed = parseInt(chatId, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  },
});

const errorHandler = errorHandlerMiddleware({
  logger,
  metrics,
});

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Creates a sendResponse function bound to a specific Telegram message context.
 * This function is injected into the use-case to keep it platform-agnostic.
 */
const createTelegramResponseSender = (message: TelegramMessage) => {
  return async (response: ChatResponse): Promise<void> => {
    await sendTelegramResponse(response, {
      chatId: message.chat.id,
      replyToMessageId: message.message_id,
    });
  };
};

// ============================================================================
// Handler
// ============================================================================

/**
 * Base handler logic for processing Telegram webhook events.
 * Exported for unit testing in isolation from middleware chain.
 */
export const baseHandler = async (event: TelegramWebhookEvent) => {
  logger.debug('Event received', { event });

  const message = event.message || event.edited_message;

  if (!message?.text) {
    return httpResponse(200, { success: true, message: 'Update acknowledged' });
  }

  // Compose the use-case with Telegram-specific response sender
  const sendResponse = createTelegramResponseSender(message);
  const useCase = processChatMessage(sendResponse);

  // Execute with event data
  const result = await useCase({
    userId: message.from?.id ?? message.chat.id,
    chatId: message.chat.id,
    messageId: message.message_id,
    messageText: message.text,
    traceId: event.context?.trace?.traceId,
  });

  return httpResponse(200, result);
};

// ============================================================================
// Middleware Chain
// ============================================================================

export const handler = middy(baseHandler)
  .use(tracingMiddleware({ component: 'telegram-webhook', logger, metrics }))
  .use(httpJsonBodyParser())
  .use(parser({ schema: TelegramUpdateSchema, envelope: ApiGatewayV2Envelope }))
  .use(signatureValidation({ required: false }))
  .use(
    abuseProtection({
      rateLimit: {
        tableName: tables.rateLimit,
        maxRequests: 6,
        windowSeconds: 60,
      },
      dailyQuota: {
        tableName: tables.dailyQuota,
        maxMessages: 100,
      },
      tokenBudget: {
        tableName: tables.tokenBudget,
        maxTokens: 30_000,
      },
    })
  )
  .use(contextManager())
  .use(errorHandler());
