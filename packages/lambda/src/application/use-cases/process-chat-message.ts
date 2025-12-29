import type { ChatResponse } from '../services/send-chat-response';

// ============================================================================
// Types (colocated with use case)
// ============================================================================

/** Function to send a response to the chat (injected during composition) */
export type SendResponseFn = (response: ChatResponse) => Promise<void>;

/** Input for processing a chat message (event data) */
export type ProcessChatMessageInput = {
  userId: number;
  chatId: number;
  messageId: number;
  messageText: string;
  traceId?: string;
};

/** Result from processing a chat message */
export type ProcessChatMessageResult = {
  success: boolean;
  processed?: {
    userId: number;
    chatId: number;
    messageLength: number;
  };
  timestamp: string;
};

/** The composed use case function signature */
export type ProcessChatMessage = (
  input: ProcessChatMessageInput
) => Promise<ProcessChatMessageResult>;

// ============================================================================
// Use Case: Process Chat Message
// ============================================================================

/**
 * Process a chat message and generate a response.
 *
 * This use case handles the core business logic:
 * - Analyzes the user message
 * - (Future) Calls product selector for recommendations
 * - (Future) Generates LLM response
 * - Sends response via injected sendResponse function
 *
 * @param sendResponse - Function to send response (injected during composition)
 * @returns The composed use case function
 *
 * @example
 * // Composition in handler
 * const useCase = processChatMessage(sendResponse);
 *
 * // Execution with event
 * await useCase({ userId, chatId, messageId, messageText });
 */
export const processChatMessage =
  (sendResponse: SendResponseFn): ProcessChatMessage =>
  async (input): Promise<ProcessChatMessageResult> => {
    const { userId, chatId, messageText } = input;

    // TODO: Implement actual message processing with LLM
    // 1. Extract user intent and constraints
    // 2. Call product selector with filters
    // 3. Generate LLM response with recommendations

    // For now, send acknowledgment response
    await sendResponse({
      text: `🤖 Message received (${messageText.length} characters). LLM processing is pending implementation.`,
    });

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
