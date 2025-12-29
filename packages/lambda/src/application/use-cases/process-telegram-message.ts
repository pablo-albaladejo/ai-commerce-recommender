// ============================================================================
// Types (colocated with use case)
// ============================================================================

/** Input for processing a Telegram message */
export type ProcessTelegramMessageInput = {
  userId: number;
  chatId: number;
  messageId: number;
  messageText: string;
  traceId?: string;
};

/** Result from processing a Telegram message */
export type ProcessTelegramMessageResult = {
  success: boolean;
  updateId?: number;
  processed?: {
    userId: number;
    chatId: number;
    messageLength: number;
  };
  response?: {
    text: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  };
  timestamp: string;
};

// ============================================================================
// Use Case: Process Telegram Message
// ============================================================================

/**
 * Process a Telegram text message and generate a response.
 *
 * This use case handles the core business logic:
 * - Analyzes the user message
 * - (Future) Calls product selector for recommendations
 * - (Future) Generates LLM response
 * - Returns structured result
 *
 * @param input - The extracted message data
 * @returns Processing result with response
 */
export const processTelegramMessage = async (
  input: ProcessTelegramMessageInput
): Promise<ProcessTelegramMessageResult> => {
  const { userId, chatId, messageText } = input;

  // TODO: Implement actual message processing with LLM
  // 1. Extract user intent and constraints
  // 2. Call product selector with filters
  // 3. Generate LLM response with recommendations

  // For now, return acknowledgment
  return {
    success: true,
    processed: {
      userId,
      chatId,
      messageLength: messageText.length,
    },
    timestamp: new Date().toISOString(),
  };
};
