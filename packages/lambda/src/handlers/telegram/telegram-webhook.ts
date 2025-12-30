import { ApiGatewayV2Envelope } from '@aws-lambda-powertools/parser/envelopes';
import { parser } from '@aws-lambda-powertools/parser/middleware';
import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import { createSingleTurnLlmAgent } from '../../application/agents/single-turn-llm-agent';
import type { ChatResponse } from '../../application/services/send-chat-response';
import { processChatMessage } from '../../application/use-cases/process-chat-message';
import { createAgentActionEmitter } from '../../infrastructure/channels/agent-action-emitter';
import { defaultPowertools } from '../../infrastructure/config/powertools-factory';
import { getDynamoDBClient } from '../../infrastructure/database/dynamodb-client';
import { createAiSdkBedrockAgentModelFromEnv } from '../../infrastructure/llm/ai-sdk-bedrock-agent-model';
import { composeCounterServices } from '../../infrastructure/services/compose-counter-services';
import {
  createAddConversationMessage,
  createGetConversationContext,
} from '../../infrastructure/services/conversation-context-service';
import { createGetAgentReplyService } from '../../infrastructure/services/get-agent-reply-service';
import { sendTelegramResponseService } from '../../infrastructure/services/send-telegram-response-service';
import * as signatureService from '../../infrastructure/services/signature-validation-service';
import { getTelegramClient } from '../../infrastructure/shared/telegram-client';
import {
  createTelegramAbuseProtection,
  createTelegramContextManager,
  createTelegramSignatureValidation,
} from '../../infrastructure/telegram/telegram-abuse-helpers';
import {
  TelegramMessage,
  TelegramUpdate,
  TelegramUpdateSchema,
} from '../../infrastructure/telegram/telegram-schemas';
import { telegramTextMessageToAgentTurn } from '../../infrastructure/telegram/telegram-turn-mapper';
import {
  getLocaleFromUpdate,
  parseTelegramUpdate,
} from '../../infrastructure/telegram/telegram-utils';
import { abuseProtectionMiddleware } from '../../middleware/abuse-protection/abuse-protection';
import { contextManagerMiddleware } from '../../middleware/context/context-manager';
import { i18nMiddleware } from '../../middleware/i18n/i18n-middleware';
import {
  errorHandlerMiddleware,
  type NotifyUser,
} from '../../middleware/observability/error-handler';
import { tracingMiddleware } from '../../middleware/observability/tracing';
import { signatureValidationMiddleware } from '../../middleware/security/signature-validation';
import { httpResponse } from '../../shared/http-response';

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
const conversationServiceConfig = {
  tableName: tables.conversationContext,
  maxMessages: 6,
  maxTokens: 4000,
  ttlHours: 24,
};
const getContext = createGetConversationContext(
  dynamoClient,
  conversationServiceConfig.tableName,
  logger
);
const addMessage = createAddConversationMessage({
  client: dynamoClient,
  config: conversationServiceConfig,
  getContext,
  logger,
});
const conversationServices = { getContext, addMessage };
const sendTelegramResponse = sendTelegramResponseService(
  telegramClient,
  logger
);

// LLM services
const generateAgentReply = createAiSdkBedrockAgentModelFromEnv();
const getAgentReply = createGetAgentReplyService(generateAgentReply);
const runAgentTurn = createSingleTurnLlmAgent(getAgentReply);

// ============================================================================
// Middleware Composition
// ============================================================================

const abuseProtection = abuseProtectionMiddleware(
  createTelegramAbuseProtection(counterServices)
);

const signatureValidation = signatureValidationMiddleware(
  createTelegramSignatureValidation(signatureService)
);

const contextManager = contextManagerMiddleware(
  createTelegramContextManager(conversationServices)
);

const telegramNotifyUser: NotifyUser = async ({ message, request }) => {
  const update = parseTelegramUpdate(request.event);
  const telegramMessage = update?.message || update?.edited_message;
  if (!telegramMessage) return;

  await sendTelegramResponse(
    { text: message },
    {
      chatId: telegramMessage.chat.id,
      replyToMessageId: telegramMessage.message_id,
    }
  );
};

const errorHandler = errorHandlerMiddleware({
  logger,
  metrics,
  notifyUser: telegramNotifyUser,
});

const i18n = i18nMiddleware({ extractLocale: getLocaleFromUpdate });

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
export const baseHandler = async (event: TelegramUpdate) => {
  logger.debug('Event received', { event });

  const message = event.message || event.edited_message;

  if (!message?.text) {
    return httpResponse(200, { success: true, message: 'Update acknowledged' });
  }

  const sendResponse = createTelegramResponseSender(message);

  const emitAction = createAgentActionEmitter(sendResponse, logger, {
    channelName: 'telegram',
  });

  const turn = telegramTextMessageToAgentTurn({
    message: { ...message, text: message.text },
  });

  const useCase = processChatMessage(emitAction, runAgentTurn);

  const output = await useCase(turn);

  return httpResponse(200, {
    success: true,
    processed: {
      channel: turn.channel,
      actorId: turn.actor.id,
      conversationId: turn.conversation.id,
      eventType: turn.event.type,
      actionsCount: output.actions.length,
    },
    llm: output.llm,
    timestamp: new Date().toISOString(),
  });
};

// ============================================================================
// Middleware Chain
// ============================================================================

export const handler = middy(baseHandler)
  .use(tracingMiddleware({ component: 'telegram-webhook', logger, metrics }))
  .use(httpJsonBodyParser())
  .use(parser({ schema: TelegramUpdateSchema, envelope: ApiGatewayV2Envelope }))
  .use(i18n())
  .use(signatureValidation({ required: process.env.ENVIRONMENT === 'prod' }))
  .use(
    abuseProtection({
      rateLimit: {
        tableName: tables.rateLimit,
        maxRequests: 2,
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
  .use(errorHandler({ component: 'telegram-webhook' }));
