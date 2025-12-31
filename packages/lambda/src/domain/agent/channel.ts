// ============================================================================
// Agent Domain - Channels
// ============================================================================

/**
 * Channel identifier for where an interaction originates (Telegram, WhatsApp, WebChat, etc.).
 *
 * We keep this open-ended to allow adding new channels without refactoring core types.
 */
export type ChannelId = 'telegram' | 'whatsapp' | 'webchat' | (string & {});
