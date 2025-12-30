// ============================================================================
// Single-turn LLM Agent (Application)
// ============================================================================

import { contentToPlainText, textContent } from '../../domain/agent/content';
import type {
  AgentTurnOutput,
  RunAgentTurn,
} from '../services/agent-engine-service';
import type { GetAgentReplyService } from '../services/get-agent-reply-service';

export type SingleTurnLlmAgentConfig = {
  /**
   * System prompt for the agent.
   * Keep it short and cost-aware.
   */
  systemPrompt: string;
};

/**
 * Minimal agent implementation:
 * - one inbound event
 * - one LLM call
 * - one outbound send_message action
 */
export const createSingleTurnLlmAgent = (
  getAgentReply: GetAgentReplyService,
  config: Partial<SingleTurnLlmAgentConfig> = {}
): RunAgentTurn => {
  return async input => {
    // For now, we run single-turn (no memory).
    // The getAgentReply service selects prompt family/version/language via the registry.
    const modelResult = await getAgentReply({
      turn: input,
      systemPromptOverride: config.systemPrompt,
    });

    const agentText = contentToPlainText(modelResult.message.content);

    const output: AgentTurnOutput = {
      actions: [
        {
          type: 'send_message',
          content: textContent(agentText),
        },
      ],
      llm: {
        modelId: modelResult.modelId,
        finishReason: modelResult.finishReason,
        tokenUsage: modelResult.tokenUsage,
      },
    };

    return output;
  };
};
