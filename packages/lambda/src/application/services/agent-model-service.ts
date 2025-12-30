// ============================================================================
// Agent Model Reply - Application Service Interface
// ============================================================================

import type { ChannelId } from '../../domain/agent/channel';
import type { AgentMessage } from '../../domain/agent/message';

/**
 * Token usage information for an LLM call.
 *
 * Note: naming uses input/output tokens to stay provider-agnostic.
 */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/**
 * Input for generating the next agent message from a dialogue history.
 *
 * Prepared for future iterations:
 * - multimodal messages (content parts)
 * - tool calls / structured outputs
 * - tracing / analytics metadata
 */
export type AgentModelInput = {
  /**
   * System instruction for the agent.
   *
   * NOTE: keep it short; avoid sending full product descriptions.
   */
  systemPrompt?: string;
  /** Dialogue history. The last message is typically the user input for the turn. */
  messages: AgentMessage[];
  /** Optional tracing metadata */
  traceId?: string;
  identity?: {
    channel?: ChannelId;
    actorId?: string;
    conversationId?: string;
  };
};

/**
 * Output returned by the agent model.
 */
export type AgentModelOutput = {
  message: AgentMessage;
  modelId?: string;
  finishReason?: string;
  tokenUsage?: TokenUsage;
};

/**
 * Application-level port for generating the agent's next message.
 * Implementations live in the infrastructure layer (e.g. AI SDK + Bedrock).
 */
export type GenerateAgentReply = (
  input: AgentModelInput
) => Promise<AgentModelOutput>;
