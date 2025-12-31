// ============================================================================
// Infrastructure - Agent Action Emitter (shared channel adapter helper)
// ============================================================================

import type { Logger } from '../../application/services/logger';
import type { ChatResponse } from '../../application/services/send-chat-response';
import type { AgentAction } from '../../domain/agent/actions';
import { contentToPlainText } from '../../domain/agent/content';

export type SendChatResponse = (response: ChatResponse) => Promise<void>;

export type AgentActionEmitterOptions = {
  channelName?: string;
};

/**
 * Creates an agent action emitter for a channel.
 *
 * Today it supports:
 * - `send_message` (degrades to plain text using `contentToPlainText`)
 *
 * This is meant to grow over time as channels add richer capabilities
 * (buttons, selections, media, etc).
 */
export const createAgentActionEmitter = (
  sendResponse: SendChatResponse,
  logger: Logger,
  options: AgentActionEmitterOptions = {}
) => {
  const channelName = options.channelName ?? 'unknown-channel';

  return async (action: AgentAction): Promise<void> => {
    switch (action.type) {
      case 'send_message':
        await sendResponse({ text: contentToPlainText(action.content) });
        return;

      default:
        logger.warn('Unsupported agent action for channel', {
          channelName,
          actionType: action.type,
        });
    }
  };
};
