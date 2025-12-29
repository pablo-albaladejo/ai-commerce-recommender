import type {
  ConversationContext,
  ConversationMessage,
} from '../../domain/conversation';

/**
 * Get conversation context for a user/chat
 */
export type GetConversationContext = (
  userId: number,
  chatId: number
) => Promise<ConversationContext | null>;

/**
 * Add message to conversation history
 */
export type AddConversationMessage = (
  userId: number,
  chatId: number,
  message: ConversationMessage
) => Promise<void>;
