// ============================================================================
// Agent Engine - Application Service Interface
// ============================================================================

import type { AgentAction } from '../../domain/agent/actions';
import type { AgentTurnInput } from '../../domain/agent/turn';

/**
 * Output of processing a single agent turn.
 */
export type AgentTurnOutput = {
  actions: AgentAction[];
  llm?: {
    modelId?: string;
    finishReason?: string;
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
};

/**
 * Application-level port for an agent engine.
 *
 * Implementations should be pure aside from calling injected ports
 * (LLM, tools, memory, etc).
 */
export type RunAgentTurn = (input: AgentTurnInput) => Promise<AgentTurnOutput>;
