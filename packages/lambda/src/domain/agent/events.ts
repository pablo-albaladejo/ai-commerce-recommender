// ============================================================================
// Agent Domain - Inbound Events
// ============================================================================

import type { Content } from './content';
import type { ChannelScopedId } from './ids';

export type UserMessageEvent = {
  type: 'user_message';
  eventId: ChannelScopedId;
  timestamp: string;
  content: Content;
};

/**
 * A structured selection coming from a UI (webchat) or interactive message (Telegram buttons).
 */
export type UserSelectionEvent = {
  type: 'user_selection';
  eventId: ChannelScopedId;
  timestamp: string;
  selection: {
    /** Stable identifier for the selection (e.g. option id). */
    id: string;
    /** Human-readable label as shown to the user. */
    label?: string;
    /** Raw value (string for now; can evolve to unknown for richer payloads). */
    value: string;
    /** Optional structured payload from the frontend. */
    data?: Record<string, unknown>;
  };
};

/**
 * Explicit commands (e.g. "/help", "/start") or frontend "actions".
 */
export type UserCommandEvent = {
  type: 'user_command';
  eventId: ChannelScopedId;
  timestamp: string;
  command: {
    name: string;
    args?: string[];
    data?: Record<string, unknown>;
  };
};

export type AgentInboundEvent =
  | UserMessageEvent
  | UserSelectionEvent
  | UserCommandEvent;
