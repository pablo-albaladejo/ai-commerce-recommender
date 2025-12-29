// ============================================================================
// Send Telegram Response - Infrastructure Service Implementation
// ============================================================================

import type { Logger } from '../../application/services/logger';
import type { SendChatResponse } from '../../application/services/send-chat-response';
import type { TelegramClient } from '../shared/telegram-client';

/**
 * Error thrown when sending a Telegram response fails.
 */
export class TelegramSendError extends Error {
  constructor(
    message: string,
    public readonly chatId: number
  ) {
    super(message);
    this.name = 'TelegramSendError';
    Object.setPrototypeOf(this, TelegramSendError.prototype);
  }
}

/**
 * Creates a SendChatResponse implementation that uses the Telegram client.
 *
 * @param telegramClient - The Telegram client (injected)
 * @param logger - Logger instance (injected)
 * @returns SendChatResponse function bound to Telegram
 * @throws TelegramSendError if sending fails
 */
export const sendTelegramResponseService = (
  telegramClient: TelegramClient,
  logger: Logger
): SendChatResponse => {
  return async (response, context): Promise<void> => {
    const success = await telegramClient.sendMessage({
      chatId: context.chatId,
      text: response.text,
      parseMode: response.parseMode,
      replyToMessageId: context.replyToMessageId,
    });

    if (!success) {
      logger.error('Failed to send response to Telegram', {
        chatId: context.chatId,
      });
      throw new TelegramSendError(
        'Failed to send response to Telegram',
        context.chatId
      );
    }
  };
};
