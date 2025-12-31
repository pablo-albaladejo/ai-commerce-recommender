// ============================================================================
// Agent Domain - Outbound Actions
// ============================================================================

import type { Content } from './content';

/**
 * Outbound actions produced by the agent engine.
 *
 * These are channel-agnostic. Channel adapters (Telegram/WhatsApp/WebChat)
 * translate them into platform-specific API calls.
 */
export type AgentAction =
  | {
      type: 'send_message';
      content: Content;
    }
  | {
      type: 'request_selection';
      prompt: Content;
      options: Array<{
        id: string;
        label: string;
        value: string;
      }>;
    }
  | {
      /**
       * Frontend command (open URL, navigate, etc).
       * Useful for webchat experiences and future richer UIs.
       */
      type: 'emit_client_command';
      command: {
        name: string;
        payload?: Record<string, unknown>;
      };
    }
  | {
      /**
       * Placeholder for commerce flows (checkout/order creation).
       * This is intentionally generic; future iterations will define a proper schema.
       */
      type: 'emit_order_intent';
      payload: Record<string, unknown>;
    };
