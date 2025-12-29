// ============================================================================
// Send Chat Response - Application Service Interface
// ============================================================================

/**
 * Response to send back to a chat.
 * This is a domain type, platform-agnostic.
 */
export type ChatResponse = {
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
};

/**
 * Context for sending a response (where to send it).
 */
export type ChatResponseContext = {
  chatId: number;
  replyToMessageId?: number;
};

/**
 * Function signature for sending a chat response.
 * The implementation is injected by infrastructure (Telegram, Instagram, etc.).
 */
export type SendChatResponse = (
  response: ChatResponse,
  context: ChatResponseContext
) => Promise<void>;
