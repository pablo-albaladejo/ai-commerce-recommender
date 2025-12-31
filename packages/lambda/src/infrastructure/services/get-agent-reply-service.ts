// ============================================================================
// Infrastructure - Get Agent Reply Service (prompt-kind implementation)
// ============================================================================

import type {
  AgentModelOutput,
  GenerateAgentReply,
} from '../../application/services/agent-model-service';
import type { GetAgentReplyService } from '../../application/services/get-agent-reply-service';
import { contentToPlainText, textContent } from '../../domain/agent/content';
import type { AgentTurnInput } from '../../domain/agent/turn';
import { getPromptDefinition } from '../shared/ai/get-prompt';

const localeToLanguage = (locale: string | undefined): string => {
  return (locale ?? 'en').split('-')[0].toUpperCase();
};

const buildTemplateInput = (turn: AgentTurnInput): Record<string, unknown> => {
  switch (turn.event.type) {
    case 'user_message':
      return { text: contentToPlainText(turn.event.content) };
    case 'user_selection':
      return {
        id: turn.event.selection.id,
        label: turn.event.selection.label ?? '',
        value: turn.event.selection.value,
      };
    case 'user_command':
      return {
        name: turn.event.command.name,
        args: (turn.event.command.args ?? []).join(' '),
      };
    default:
      // Exhaustiveness check: this should never happen if types are correct
      const _exhaustive: never = turn.event;
      throw new Error(
        `Unexpected event type: ${(_exhaustive as { type: string }).type}`
      );
  }
};

const getFamilyForTurn = (
  turn: AgentTurnInput
): 'message' | 'selection' | 'command' => {
  switch (turn.event.type) {
    case 'user_message':
      return 'message';
    case 'user_selection':
      return 'selection';
    case 'user_command':
      return 'command';
    default:
      // Exhaustiveness check: this should never happen if types are correct
      const _exhaustive: never = turn.event;
      throw new Error(
        `Unexpected event type: ${(_exhaustive as { type: string }).type}`
      );
  }
};

export const createGetAgentReplyService = (
  generateAgentReply: GenerateAgentReply
): GetAgentReplyService => {
  return async ({ turn, systemPromptOverride }): Promise<AgentModelOutput> => {
    const family = getFamilyForTurn(turn);
    const templateInput = buildTemplateInput(turn);
    const language = localeToLanguage(turn.locale);

    const { systemPrompt, userPrompt } = getPromptDefinition('agentReply', {
      family,
      templateParams: { version: 'v1', language },
      templateInput,
    });

    // NOTE: today we call the model as text generation.
    // Future: use structuredOutput + generateObject for typed replies/actions.
    return generateAgentReply({
      systemPrompt: systemPromptOverride ?? systemPrompt.prompt,
      messages: [{ role: 'user', content: textContent(userPrompt.prompt) }],
      identity: {
        channel: turn.channel,
        actorId: turn.actor.id,
        conversationId: turn.conversation.id,
      },
    });
  };
};
