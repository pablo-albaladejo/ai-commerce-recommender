// ============================================================================
// Agent Domain - Turn Envelope
// ============================================================================

import type { ChannelId } from './channel';
import type { AgentInboundEvent } from './events';
import type { ActorRef, ConversationRef } from './ids';

/**
 * A single inbound "turn" the agent needs to process.
 *
 * This is the domain entrypoint: regardless of Telegram/WhatsApp/WebChat,
 * the channel adapter should translate raw platform events into this shape.
 */
export type AgentTurnInput = {
  channel: ChannelId;
  actor: ActorRef;
  conversation: ConversationRef;
  event: AgentInboundEvent;
  locale?: string;
};
