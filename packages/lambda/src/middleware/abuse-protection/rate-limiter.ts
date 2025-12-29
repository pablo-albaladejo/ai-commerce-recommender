import middy from '@middy/core';
import type { CheckRateLimit } from '../../application/services/counter-service';
import type { CounterResult } from '../../domain/counter';
import { RateLimitError } from '../../domain/errors';
import { httpResponse } from '../../shared/http-response';

type RateLimiterConfig = {
  tableName: string;
  maxRequests?: number;
  windowSeconds?: number;
};

export type OnRateLimitExceeded = (
  chatId: string,
  info: { retryAfter?: number; limit: number; remaining: number }
) => Promise<void>;

type RateLimiterDependencies = {
  checkRateLimit: CheckRateLimit;
  extractChatId: (event: unknown) => string | undefined;
  onLimitExceeded?: OnRateLimitExceeded;
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
          const errorInfo = {
            retryAfter: result.retryAfter,
            limit: result.limit,
            remaining: result.remaining,
          };

          // If callback provided, notify user and return early (no error thrown)
          if (deps.onLimitExceeded) {
            await deps.onLimitExceeded(chatId, errorInfo);
            request.response = httpResponse(200, {
              success: true,
              message: 'Rate limit notification sent',
            });
            return request.response;
          }

          // No callback: throw error for error handler
          throw new RateLimitError(
            'Too many requests, please wait and try again',
            errorInfo
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
