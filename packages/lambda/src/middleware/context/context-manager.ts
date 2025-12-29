import middy from '@middy/core';
import type {
  AddConversationMessage,
  GetConversationContext,
} from '../../application/services/conversation-service';
import type {
  ConversationContext,
  ConversationMessage,
} from '../../domain/conversation';
import type { ExtendedLambdaContext } from '../types/lambda-context';

// ============================================================================
// Re-export domain types for convenience
// ============================================================================

export type { ConversationContext, ConversationMessage };

// ============================================================================
// Token Estimation (pure function)
// ============================================================================

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

// ============================================================================
// Types
// ============================================================================

type ContextManagerConfig = {
  maxMessages?: number;
  maxTokens?: number;
};

type ContextManagerDependencies = {
  getContext: GetConversationContext;
  addMessage: AddConversationMessage;
  extractUserId: (event: unknown) => number | undefined;
  extractChatId: (event: unknown) => number | undefined;
};

// ============================================================================
// Middleware
// ============================================================================

type ContextExtension = {
  conversationContext?: ConversationContext | null;
  contextDeps?: ContextManagerDependencies;
  contextUserChat?: { userId: number; chatId: number };
  newConversationMessages?: ConversationMessage[];
};

export const contextManagerMiddleware =
  (deps: ContextManagerDependencies) =>
  (_config: ContextManagerConfig = {}): middy.MiddlewareObj => {
    return {
      before: async request => {
        const ctx = request.context as unknown as ExtendedLambdaContext &
          ContextExtension;
        const userId = deps.extractUserId(request.event);
        const chatId = deps.extractChatId(request.event);

        if (!userId || !chatId) return;

        const context = await deps.getContext(userId, chatId);

        ctx.conversationContext = context;
        ctx.contextDeps = deps;
        ctx.contextUserChat = { userId, chatId };
      },

      after: async request => {
        const ctx = request.context as unknown as ContextExtension;
        const newMessages = ctx.newConversationMessages;
        const userChat = ctx.contextUserChat;
        const contextDeps = ctx.contextDeps;

        if (!newMessages?.length || !userChat || !contextDeps) return;

        for (const msg of newMessages) {
          await contextDeps.addMessage(userChat.userId, userChat.chatId, msg);
        }
      },
    };
  };

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get conversation context from Lambda context
 */
export const getConversationContext = (
  context: unknown
): ConversationContext | null => {
  const ctx = context as ContextExtension;
  return ctx.conversationContext || null;
};

/**
 * Add messages to be saved after request completes
 */
export const addConversationMessages = (
  context: unknown,
  messages: ConversationMessage[]
): void => {
  const ctx = context as ContextExtension;
  const existing = ctx.newConversationMessages || [];
  ctx.newConversationMessages = [...existing, ...messages];
};

/**
 * Create a message object
 */
export const createMessage = (
  role: 'user' | 'assistant',
  content: string
): ConversationMessage => ({
  role,
  content,
  timestamp: new Date().toISOString(),
  tokenCount: estimateTokens(content),
});
