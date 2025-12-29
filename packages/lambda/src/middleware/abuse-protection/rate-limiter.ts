import middy from '@middy/core';
import type { CheckRateLimit } from '../../application/services/counter-service';
import type { CounterResult } from '../../domain/counter';
import { RateLimitError } from '../../domain/errors';

type RateLimiterConfig = {
  tableName: string;
  maxRequests?: number;
  windowSeconds?: number;
};

type RateLimiterDependencies = {
  checkRateLimit: CheckRateLimit;
  extractChatId: (event: unknown) => string | undefined;
};

export const rateLimiterMiddleware =
  (deps: RateLimiterDependencies) =>
  (config: RateLimiterConfig): middy.MiddlewareObj => {
    const { tableName, maxRequests = 6, windowSeconds = 60 } = config;

    return {
      before: async request => {
        const chatId = deps.extractChatId(request.event);
        if (!chatId) return;

        const result = await deps.checkRateLimit(`chat#${chatId}`, {
          tableName,
          limit: maxRequests,
          windowSeconds,
        });

        // Store for headers in after
        (request.context as unknown as Record<string, unknown>).rateLimitInfo =
          result;

        if (!result.allowed) {
          throw new RateLimitError(
            'Too many requests, please wait and try again',
            {
              retryAfter: result.retryAfter,
              limit: result.limit,
              remaining: result.remaining,
            }
          );
        }
      },

      after: async request => {
        const info = (request.context as unknown as Record<string, unknown>)
          .rateLimitInfo as CounterResult | undefined;

        if (info && request.response?.headers) {
          request.response.headers['X-RateLimit-Limit'] = String(info.limit);
          request.response.headers['X-RateLimit-Remaining'] = String(
            info.remaining
          );
        }
      },
    };
  };
