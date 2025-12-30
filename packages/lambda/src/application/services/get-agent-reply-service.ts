// ============================================================================
// Get Agent Reply - Application Service Interface
// ============================================================================

import type { AgentTurnInput } from '../../domain/agent/turn';
import type { AgentModelOutput } from './agent-model-service';

export type GetAgentReplyParams = {
  turn: AgentTurnInput;
  /**
   * Optional override for the system prompt.
   * Useful for experiments or environment-specific tuning.
   */
  systemPromptOverride?: string;
};

/**
 * High-level LLM service for the "agent reply" prompt kind.
 *
 * The key idea: one service per prompt kind / capability.
 * Internally it can select prompt families, versions, languages, and schemas.
 */
export type GetAgentReplyService = (
  params: GetAgentReplyParams
) => Promise<AgentModelOutput>;
