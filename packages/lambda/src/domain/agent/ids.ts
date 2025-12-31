// ============================================================================
// Agent Domain - Cross-channel IDs
// ============================================================================

import type { ChannelId } from './channel';

/**
 * A channel-scoped identifier, represented as a string.
 *
 * Examples:
 * - { channel: 'telegram', id: '123' }
 * - { channel: 'webchat', id: 'session:abc' }
 */
export type ChannelScopedId = {
  channel: ChannelId;
  id: string;
};

/**
 * Actor that initiated an interaction.
 *
 * In the future, we may support agent-to-agent or system events; for now it is mostly `user`.
 */
export type ActorRef = ChannelScopedId & {
  kind: 'user' | 'agent' | 'system';
};

/**
 * Conversation reference (chat/thread/session) in a channel.
 */
export type ConversationRef = ChannelScopedId;
