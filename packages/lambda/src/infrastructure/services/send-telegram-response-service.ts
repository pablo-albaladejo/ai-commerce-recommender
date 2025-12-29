// ============================================================================
// Send Telegram Response - Infrastructure Service Implementation
// ============================================================================

import type { SendChatResponse } from '../../application/services/send-chat-response';
import type { TelegramClient } from '../shared/telegram-client';

/**
 * Creates a SendChatResponse implementation that uses the Telegram client.
 *
 * @param telegramClient - The Telegram client (injected)
 * @returns SendChatResponse function bound to Telegram
 */
export const sendTelegramResponseService = (
  telegramClient: TelegramClient
): SendChatResponse => {
  return async (response, context): Promise<void> => {
    const success = await telegramClient.sendMessage({
      chatId: context.chatId,
      text: response.text,
      parseMode: response.parseMode,
      replyToMessageId: context.replyToMessageId,
    });

    if (!success) {
      console.error('Failed to send response to Telegram', {
        chatId: context.chatId,
      });
    }
  };
};
