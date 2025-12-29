import middy from '@middy/core';
import type { CheckDailyCounter } from '../../application/services/counter-service';
import type { CounterResult } from '../../domain/counter';
import { DailyQuotaError } from '../../domain/errors';

type DailyQuotaConfig = {
  tableName: string;
  maxMessages?: number;
};

type DailyQuotaDependencies = {
  checkDailyQuota: CheckDailyCounter;
  extractUserId: (event: unknown) => number | undefined;
};

export const dailyQuotaMiddleware =
  (deps: DailyQuotaDependencies) =>
  (config: DailyQuotaConfig): middy.MiddlewareObj => {
    const { tableName, maxMessages = 100 } = config;

    return {
      before: async request => {
        const userId = deps.extractUserId(request.event);
        if (!userId) return;

        const result = await deps.checkDailyQuota(userId, {
          tableName,
          limit: maxMessages,
        });

        (request.context as unknown as Record<string, unknown>).dailyQuotaInfo =
          result;

        if (!result.allowed) {
          throw new DailyQuotaError(
            'Daily limit reached, please try again tomorrow',
            {
              limit: result.limit,
              used: result.current,
              resetTime: String(result.resetTime),
            }
          );
        }
      },

      after: async request => {
        const info = (request.context as unknown as Record<string, unknown>)
          .dailyQuotaInfo as CounterResult | undefined;

        if (info && request.response?.headers) {
          request.response.headers['X-DailyQuota-Limit'] = String(info.limit);
          request.response.headers['X-DailyQuota-Remaining'] = String(
            info.remaining
          );
        }
      },
    };
  };
