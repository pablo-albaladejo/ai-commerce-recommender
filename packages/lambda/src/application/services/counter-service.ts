import type {
  CounterConfig,
  CounterResult,
  TokenUsageData,
} from '../../domain/counter';

/**
 * Counter service function types (granular)
 * Each operation is a separate function type
 */

export type CheckRateLimit = (
  key: string,
  config: CounterConfig
) => Promise<CounterResult>;

export type CheckDailyCounter = (
  userId: number,
  config: CounterConfig,
  increment?: number
) => Promise<CounterResult>;

export type RecordTokenUsage = (data: TokenUsageData) => Promise<void>;
