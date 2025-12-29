// ============================================================================
// Telegram API Client (Singleton)
// ============================================================================

import type { Logger } from '@aws-lambda-powertools/logger';

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
};

// Singleton instance
let telegramClient: TelegramClient | undefined;

/**
 * Get or create the Telegram client singleton.
 * Configuration is provided by the entry-point (Lambda handler).
 */
export const getTelegramClient = (
  params: GetTelegramClientParams
): TelegramClient => {
  if (!telegramClient) {
    const { botToken, logger } = params;
    const baseUrl = `https://api.telegram.org/bot${botToken}`;

    telegramClient = {
      sendMessage: async (
        messageParams: SendMessageParams
      ): Promise<boolean> => {
        const url = `${baseUrl}/sendMessage`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: messageParams.chatId,
            text: messageParams.text,
            parse_mode: messageParams.parseMode,
            reply_to_message_id: messageParams.replyToMessageId,
          }),
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
      },
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
