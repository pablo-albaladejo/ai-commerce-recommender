import middy from '@middy/core';
import type {
  CheckDailyCounter,
  CheckRateLimit,
  RecordTokenUsage,
} from '../../application/services/counter-service';
import { dailyQuotaMiddleware, type OnDailyQuotaExceeded } from './daily-quota';
import {
  rateLimiterMiddleware,
  type OnRateLimitExceeded,
} from './rate-limiter';
import {
  tokenBudgetMiddleware,
  type OnTokenBudgetExceeded,
} from './token-budget';

// Re-export errors and helper for convenience
export {
  DailyQuotaError,
  RateLimitError,
  TokenBudgetError,
} from '../../domain/errors';
export { recordActualTokenUsage } from './token-budget';
export type {
  OnRateLimitExceeded,
  OnDailyQuotaExceeded,
  OnTokenBudgetExceeded,
};

// ============================================================================
// Configuration Types
// ============================================================================

export type AbuseProtectionConfig = {
  rateLimit: {
    enabled?: boolean;
    tableName: string;
    maxRequests?: number;
    windowSeconds?: number;
  };
  dailyQuota: {
    enabled?: boolean;
    tableName: string;
    maxMessages?: number;
  };
  tokenBudget: {
    enabled?: boolean;
    tableName: string;
    maxTokens?: number;
    estimatedTokensPerRequest?: number;
  };
};

export type AbuseProtectionDependencies = {
  checkRateLimit: CheckRateLimit;
  checkDailyQuota: CheckDailyCounter;
  recordTokenUsage: RecordTokenUsage;
  extractChatId: (event: unknown) => string | undefined;
  extractUserId: (event: unknown) => number | undefined;
  // Optional callbacks for user notification
  onRateLimitExceeded?: OnRateLimitExceeded;
  onDailyQuotaExceeded?: OnDailyQuotaExceeded;
  onTokenBudgetExceeded?: OnTokenBudgetExceeded;
};

// ============================================================================
// Combined Abuse Protection Middleware (composition only)
// ============================================================================

/**
 * Combined middleware that applies all abuse protection in order:
 * 1. Rate limiting (per minute)
 * 2. Daily quota (messages per day)
 * 3. Token budget (tokens per day)
 */
export const abuseProtectionMiddleware =
  (deps: AbuseProtectionDependencies) =>
  (config: AbuseProtectionConfig): middy.MiddlewareObj[] => {
    const middlewares: middy.MiddlewareObj[] = [];

    if (config.rateLimit.enabled !== false) {
      middlewares.push(
        rateLimiterMiddleware({
          checkRateLimit: deps.checkRateLimit,
          extractChatId: deps.extractChatId,
          onLimitExceeded: deps.onRateLimitExceeded,
        })({
          tableName: config.rateLimit.tableName,
          maxRequests: config.rateLimit.maxRequests,
          windowSeconds: config.rateLimit.windowSeconds,
        })
      );
    }

    if (config.dailyQuota.enabled !== false) {
      middlewares.push(
        dailyQuotaMiddleware({
          checkDailyQuota: deps.checkDailyQuota,
          extractUserId: deps.extractUserId,
          onQuotaExceeded: deps.onDailyQuotaExceeded,
        })({
          tableName: config.dailyQuota.tableName,
          maxMessages: config.dailyQuota.maxMessages,
        })
      );
    }

    if (config.tokenBudget.enabled !== false) {
      middlewares.push(
        tokenBudgetMiddleware({
          checkDailyQuota: deps.checkDailyQuota,
          recordTokenUsage: deps.recordTokenUsage,
          extractUserId: deps.extractUserId,
          onBudgetExceeded: deps.onTokenBudgetExceeded,
        })({
          tableName: config.tokenBudget.tableName,
          maxTokens: config.tokenBudget.maxTokens,
          estimatedTokensPerRequest:
            config.tokenBudget.estimatedTokensPerRequest,
        })
      );
    }

    return middlewares;
  };
