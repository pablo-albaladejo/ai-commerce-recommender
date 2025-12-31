// ============================================================================
// Agent Domain - Dialogue Messages
// ============================================================================

import type { Content } from './content';

/**
 * Roles in an agent/user dialogue.
 *
 * We intentionally use `agent` (not `assistant`) at the domain level.
 * LLM adapters can map this to provider-specific roles (e.g. "assistant").
 */
export type AgentMessageRole = 'user' | 'agent';

export type AgentMessage = {
  role: AgentMessageRole;
  content: Content;
};
