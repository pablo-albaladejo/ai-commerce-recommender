import middy from '@middy/core';
import type {
  CheckDailyCounter,
  RecordTokenUsage,
} from '../../application/services/counter-service';
import type { CounterResult } from '../../domain/counter';
import { TokenBudgetError } from '../../domain/errors';

type TokenBudgetConfig = {
  tableName: string;
  maxTokens?: number;
  estimatedTokensPerRequest?: number;
};

type TokenBudgetDependencies = {
  checkDailyQuota: CheckDailyCounter;
  recordTokenUsage: RecordTokenUsage;
  extractUserId: (event: unknown) => number | undefined;
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

        (
          request.context as unknown as Record<string, unknown>
        ).tokenBudgetInfo = {
          ...result,
          userId,
          tableName,
        };

        if (!result.allowed) {
          throw new TokenBudgetError(
            'Daily token budget exceeded, please try again tomorrow',
            {
              limit: result.limit,
              used: result.current,
              resetTime: String(result.resetTime),
            }
          );
        }
      },

      after: async request => {
        const ctx = request.context as unknown as Record<string, unknown>;
        const info = ctx.tokenBudgetInfo as
          | (CounterResult & { userId: number; tableName: string })
          | undefined;
        const actualUsage = ctx.actualTokenUsage as
          | { inputTokens: number; outputTokens: number }
          | undefined;

        // Record actual token usage if available
        if (actualUsage && info?.userId) {
          await deps.recordTokenUsage({
            userId: info.userId,
            tableName: info.tableName,
            inputTokens: actualUsage.inputTokens,
            outputTokens: actualUsage.outputTokens,
          });
        }

        // Add response headers
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
