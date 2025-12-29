// ============================================================================
// Telegram API Client (Singleton)
// ============================================================================

import type { Logger } from '@aws-lambda-powertools/logger';

/** Default timeout for Telegram API calls (10 seconds) */
const DEFAULT_TIMEOUT_MS = 10_000;

export type SendMessageParams = {
  chatId: number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyToMessageId?: number;
};

export type TelegramClient = {
  sendMessage: (params: SendMessageParams) => Promise<boolean>;
};

export type GetTelegramClientParams = {
  botToken: string;
  logger: Logger;
  timeoutMs?: number;
};

// Singleton instance and configuration
let telegramClient: TelegramClient | undefined;
let configuredBotToken: string | undefined;

type LogApiErrorParams = {
  logger: Logger;
  chatId: number;
  error: unknown;
  timeoutMs: number;
};

/** Logs error details for failed Telegram API calls */
const logApiError = ({
  logger,
  chatId,
  error,
  timeoutMs,
}: LogApiErrorParams): void => {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  const message = isTimeout
    ? 'Telegram API call timed out'
    : 'Telegram API call failed';
  const details = isTimeout
    ? { chatId, timeoutMs }
    : {
        chatId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
  logger.error(message, details);
};

/** Creates the sendMessage function with configured baseUrl, logger, and timeout */
const createSendMessage =
  (baseUrl: string, logger: Logger, timeoutMs: number) =>
  async (messageParams: SendMessageParams): Promise<boolean> => {
    const url = `${baseUrl}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: messageParams.chatId,
          text: messageParams.text,
          parse_mode: messageParams.parseMode,
          reply_to_message_id: messageParams.replyToMessageId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('Failed to send Telegram message', {
          status: response.status,
          error: errorBody,
          chatId: messageParams.chatId,
        });
        return false;
      }
      return true;
    } catch (error) {
      logApiError({ logger, chatId: messageParams.chatId, error, timeoutMs });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  };

/**
 * Get or create the Telegram client singleton.
 * Warning: Subsequent calls with different botToken will be ignored.
 */
export const getTelegramClient = (
  params: GetTelegramClientParams
): TelegramClient => {
  const { botToken, logger, timeoutMs = DEFAULT_TIMEOUT_MS } = params;

  if (telegramClient && configuredBotToken !== botToken) {
    logger.warn(
      'getTelegramClient called with different botToken - using existing client'
    );
  }

  if (!telegramClient) {
    configuredBotToken = botToken;
    const baseUrl = `https://api.telegram.org/bot${botToken}`;
    telegramClient = {
      sendMessage: createSendMessage(baseUrl, logger, timeoutMs),
    };
  }

  return telegramClient;
};

/**
 * Reset the singleton (useful for testing).
 */
export const resetTelegramClient = (): void => {
  telegramClient = undefined;
};
