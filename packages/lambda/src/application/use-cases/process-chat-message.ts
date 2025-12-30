import type { AgentAction } from '../../domain/agent/actions';
import type { AgentTurnInput } from '../../domain/agent/turn';
import type {
  AgentTurnOutput,
  RunAgentTurn,
} from '../services/agent-engine-service';

// ============================================================================
// Types (colocated with use case)
// ============================================================================

/** Function to emit an agent action (injected during composition). */
export type EmitAgentAction = (action: AgentAction) => Promise<void>;

/** Input for processing an agent turn. */
export type ProcessChatMessageInput = AgentTurnInput;

/** The composed use case function signature */
export type ProcessChatMessage = (
  input: ProcessChatMessageInput
) => Promise<AgentTurnOutput>;

// ============================================================================
// Use Case: Process Chat Message
// ============================================================================

/**
 * Process a single agent "turn" and emit outbound actions.
 *
 * This use case is platform-agnostic:
 * - Channel adapters translate raw platform updates into `AgentTurnInput`
 * - Agent engines decide which `AgentAction[]` to emit
 * - Channel adapters execute emitted actions (Telegram, WhatsApp, WebChat, ...)
 *
 * @param emitAction - Function to emit a single action (injected during composition)
 * @param runAgentTurn - Agent engine (injected during composition)
 * @returns The composed use case function
 *
 * @example
 * // Composition in handler
 * const useCase = processChatMessage(emitAction, runAgentTurn);
 *
 * // Execution with event
 * await useCase(turnInput);
 */
export const processChatMessage =
  (
    emitAction: EmitAgentAction,
    runAgentTurn: RunAgentTurn
  ): ProcessChatMessage =>
  async (input): Promise<AgentTurnOutput> => {
    const output = await runAgentTurn(input);

    for (const action of output.actions) {
      await emitAction(action);
    }

    return output;
  };
