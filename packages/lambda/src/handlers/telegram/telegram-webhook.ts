import { ApiGatewayV2Envelope } from '@aws-lambda-powertools/parser/envelopes';
import { parser } from '@aws-lambda-powertools/parser/middleware';
import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import { processTelegramMessage } from '../../application/use-cases/process-telegram-message';
import { defaultPowertools } from '../../infrastructure/config/powertools-factory';
import { getDynamoDBClient } from '../../infrastructure/database/dynamodb-client';
import { composeConversationServices } from '../../infrastructure/services/compose-conversation-services';
import { composeCounterServices } from '../../infrastructure/services/compose-counter-services';
import {
  getSecretToken,
  validateSignature,
} from '../../infrastructure/services/signature-validation-service';
import { defaultTelegramClient } from '../../infrastructure/telegram/telegram-client';
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
  rateLimit: process.env.RATE_LIMIT_TABLE || 'rate-limits',
  dailyQuota: process.env.DAILY_QUOTA_TABLE || 'daily-quotas',
  tokenBudget: process.env.TOKEN_BUDGET_TABLE || 'token-budgets',
  conversationContext: process.env.CONTEXT_TABLE || 'conversation-contexts',
};

// ============================================================================
// Infrastructure Composition
// ============================================================================

const dynamoClient = getDynamoDBClient();
const { logger, metrics } = defaultPowertools;

const counterServices = composeCounterServices(dynamoClient);
const conversationServices = composeConversationServices(dynamoClient, {
  tableName: tables.conversationContext,
  maxMessages: 6,
});

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
    return chatId ? parseInt(chatId, 10) : undefined;
  },
});

const errorHandler = errorHandlerMiddleware({
  logger,
  metrics,
});

// ============================================================================
// Response Helpers
// ============================================================================

const buildDefaultResponse = (
  firstName: string | undefined,
  text: string
): string =>
  `👋 ¡Hola ${firstName || 'usuario'}!\n\nRecibí tu mensaje: "${text}"\n\n🤖 El bot está funcionando correctamente.`;

const sendResponseToTelegram = async (
  message: TelegramMessage,
  result: Awaited<ReturnType<typeof processTelegramMessage>>
): Promise<void> => {
  if (!result.success) return;

  const responseText =
    result.response?.text ||
    buildDefaultResponse(message.from?.first_name, message.text || '');

  await defaultTelegramClient.sendMessage({
    chatId: message.chat.id,
    text: responseText,
    replyToMessageId: message.message_id,
  });
};

// ============================================================================
// Handler
// ============================================================================

/**
 * Base handler logic for processing Telegram webhook events.
 * Exported for unit testing in isolation from middleware chain.
 */
export const baseHandler = async (event: TelegramWebhookEvent) => {
  // Debug: log the full event structure
  console.log('DEBUG event:', JSON.stringify(event, null, 2));

  const message = event.message || event.edited_message;

  if (!message?.text) {
    return httpResponse(200, { success: true, message: 'Update acknowledged' });
  }

  const result = await processTelegramMessage({
    userId: message.from?.id ?? 0,
    chatId: message.chat.id,
    messageId: message.message_id,
    messageText: message.text,
    traceId: event.context?.trace?.traceId,
  });

  await sendResponseToTelegram(message, result);

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
