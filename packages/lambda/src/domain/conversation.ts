/**
 * Conversation domain types
 */

/**
 * Message in a conversation
 */
export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokenCount?: number;
};

/**
 * Conversation context with message history
 */
export type ConversationContext = {
  messages: ConversationMessage[];
  summary?: string;
  totalTokens: number;
};

/**
 * Configuration for context management
 */
export type ContextManagerConfig = {
  tableName?: string;
  maxMessages?: number;
  maxTokens?: number;
  ttlHours?: number;
};
