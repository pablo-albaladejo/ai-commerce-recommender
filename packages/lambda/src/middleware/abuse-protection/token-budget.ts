import middy from '@middy/core';
import type {
  CheckDailyCounter,
  RecordTokenUsage,
} from '../../application/services/counter-service';
import type { CounterResult } from '../../domain/counter';
import { TokenBudgetError } from '../../domain/errors';
import { httpResponse } from '../../shared/http-response';

type TokenBudgetConfig = {
  tableName: string;
  maxTokens?: number;
  estimatedTokensPerRequest?: number;
};

export type OnTokenBudgetExceeded = (
  userId: number,
  info: { limit: number; used: number; resetTime: string }
) => Promise<void>;

type TokenBudgetDependencies = {
  checkDailyQuota: CheckDailyCounter;
  recordTokenUsage: RecordTokenUsage;
  extractUserId: (event: unknown) => number | undefined;
  onBudgetExceeded?: OnTokenBudgetExceeded;
};

type TokenBudgetInfo = CounterResult & { userId: number; tableName: string };
type TokenUsage = { inputTokens: number; outputTokens: number };

const getContextData = (ctx: Record<string, unknown>) => ({
  info: ctx.tokenBudgetInfo as TokenBudgetInfo | undefined,
  usage: ctx.actualTokenUsage as TokenUsage | undefined,
});

const handleBudgetExceeded = async (
  userId: number,
  result: CounterResult,
  onBudgetExceeded?: OnTokenBudgetExceeded
) => {
  const errorInfo = {
    limit: result.limit,
    used: result.current,
    resetTime: String(result.resetTime),
  };

  if (onBudgetExceeded) {
    await onBudgetExceeded(userId, errorInfo);
    return httpResponse(200, {
      success: true,
      message: 'Token budget notification sent',
    });
  }

  throw new TokenBudgetError(
    'Daily token budget exceeded, please try again tomorrow',
    errorInfo
  );
};

export const tokenBudgetMiddleware =
  (deps: TokenBudgetDependencies) =>
  (config: TokenBudgetConfig): middy.MiddlewareObj => {
    const {
      tableName,
      maxTokens = 30_000,
      estimatedTokensPerRequest = 300,
    } = config;

    return {
      before: async request => {
        const userId = deps.extractUserId(request.event);
        if (!userId) return;

        const result = await deps.checkDailyQuota(
          userId,
          { tableName, limit: maxTokens },
          estimatedTokensPerRequest
        );

        const ctx = request.context as unknown as Record<string, unknown>;
        ctx.tokenBudgetInfo = { ...result, userId, tableName };

        if (!result.allowed) {
          request.response = await handleBudgetExceeded(
            userId,
            result,
            deps.onBudgetExceeded
          );
          return request.response;
        }
      },

      after: async request => {
        const ctx = request.context as unknown as Record<string, unknown>;
        const { info, usage } = getContextData(ctx);

        if (usage && info?.userId) {
          await deps.recordTokenUsage({
            userId: info.userId,
            tableName: info.tableName,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          });
        }

        if (info && request.response?.headers) {
          request.response.headers['X-TokenBudget-Limit'] = String(info.limit);
          request.response.headers['X-TokenBudget-Remaining'] = String(
            info.remaining
          );
        }
      },
    };
  };

/** Helper to record actual token usage (call after LLM response) */
export const recordActualTokenUsage = (
  context: unknown,
  inputTokens: number,
  outputTokens: number
): void => {
  (context as Record<string, unknown>).actualTokenUsage = {
    inputTokens,
    outputTokens,
  };
};
