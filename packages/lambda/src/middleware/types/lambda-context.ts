// Extended Lambda context types shared across middlewares
import type { Context } from 'aws-lambda';

export type TraceContext = {
  traceId: string;
  requestId: string;
  userId?: number;
  chatId?: number;
  timestamp: string;
  correlationId?: string;
  sessionId?: string;
  parentSpanId?: string;
  spanId: string;
};

// Extended Lambda context with middleware information
export type ExtendedLambdaContext = Context & {
  trace: TraceContext;
  env?: Record<string, string>;
  user?: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
  };
  config?: Record<string, unknown>;
  // Middleware-specific context properties
  rateLimitInfo?: {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter: number;
  };
  dailyQuotaInfo?: {
    allowed: boolean;
    userId: number;
    date: string;
    currentUsage: number;
    dailyLimit: number;
    remaining: number;
    resetTime: string;
  };
  tokenBudgetInfo?: {
    allowed: boolean;
    userId: number;
    date: string;
    currentTotalTokens: number;
    dailyTokenLimit: number;
    remainingTokens: number;
    resetTime: string;
  };
  conversationContext?: unknown;
  newConversationMessages?: unknown[];
  actualTokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
};
