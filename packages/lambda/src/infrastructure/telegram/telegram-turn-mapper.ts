// ============================================================================
// Telegram -> Agent Turn Mapper (Channel Adapter)
// ============================================================================

import { textContent } from '../../domain/agent/content';
import type { AgentTurnInput } from '../../domain/agent/turn';
import type { TelegramMessage } from './telegram-schemas';

export type TelegramTextMessage = TelegramMessage & { text: string };

export type TelegramTextMessageToAgentTurnParams = {
  message: TelegramTextMessage;
};

/**
 * Maps a Telegram text message into the agent-domain turn input.
 *
 * This is a channel adapter concern (DTO -> domain), not business logic.
 */
export const telegramTextMessageToAgentTurn = (
  params: TelegramTextMessageToAgentTurnParams
): AgentTurnInput => {
  const channel = 'telegram' as const;
  const { message } = params;

  return {
    channel,
    actor: {
      channel,
      id: String(message.from?.id ?? message.chat.id),
      kind: 'user',
    },
    conversation: {
      channel,
      id: String(message.chat.id),
    },
    event: {
      type: 'user_message',
      eventId: { channel, id: String(message.message_id) },
      timestamp: new Date(message.date * 1000).toISOString(),
      content: textContent(message.text),
    },
    locale: message.from?.language_code,
  };
};
