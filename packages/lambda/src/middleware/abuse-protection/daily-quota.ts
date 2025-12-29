import middy from '@middy/core';
import type { CheckDailyCounter } from '../../application/services/counter-service';
import type { CounterResult } from '../../domain/counter';
import { DailyQuotaError } from '../../domain/errors';
import { httpResponse } from '../../shared/http-response';

type DailyQuotaConfig = {
  tableName: string;
  maxMessages?: number;
};

export type OnDailyQuotaExceeded = (
  userId: number,
  info: { limit: number; used: number; resetTime: string }
) => Promise<void>;

type DailyQuotaDependencies = {
  checkDailyQuota: CheckDailyCounter;
  extractUserId: (event: unknown) => number | undefined;
  onQuotaExceeded?: OnDailyQuotaExceeded;
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
          const errorInfo = {
            limit: result.limit,
            used: result.current,
            resetTime: String(result.resetTime),
          };

          if (deps.onQuotaExceeded) {
            await deps.onQuotaExceeded(userId, errorInfo);
            request.response = httpResponse(200, {
              success: true,
              message: 'Daily quota notification sent',
            });
            return request.response;
          }

          throw new DailyQuotaError(
            'Daily limit reached, please try again tomorrow',
            errorInfo
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
