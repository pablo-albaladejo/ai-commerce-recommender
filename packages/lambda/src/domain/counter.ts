// ============================================================================
// Counter Domain Types (for rate limiting, quotas, and token budgets)
// ============================================================================

/** Result from counter operations */
export type CounterResult = {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetTime: string | number;
  retryAfter?: number;
};

/** Counter configuration */
export type CounterConfig = {
  tableName: string;
  limit: number;
  windowSeconds?: number;
  ttlDays?: number;
};

/** Token usage data */
export type TokenUsageData = {
  userId: number;
  tableName: string;
  inputTokens: number;
  outputTokens: number;
};

/** Rate limit check input */
export type RateLimitInput = {
  key: string;
  config: CounterConfig;
};

/** Daily counter check input */
export type DailyCounterInput = {
  userId: number;
  config: CounterConfig;
  increment?: number;
};
