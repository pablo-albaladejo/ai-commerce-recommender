/**
 * Counter record type - defined in application layer as repository interface
 */
export type CounterRecord = {
  pk: string;
  count?: number;
  window_start?: number;
  user_id?: number;
  date?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
  updated_at?: string;
  ttl?: number;
};

/**
 * Counter repository function types (granular)
 * Each operation is a separate function type
 */

export type GetCounterRecord = (
  tableName: string,
  key: string
) => Promise<CounterRecord | null>;

export type PutCounterRecord = (
  tableName: string,
  record: CounterRecord
) => Promise<void>;

export type IncrementCounterParams = {
  tableName: string;
  key: string;
  increment: number;
  ttl: number;
  limit: number;
};

export type IncrementCounterRecord = (
  params: IncrementCounterParams
) => Promise<void>;

export type IncrementTokensParams = {
  tableName: string;
  key: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  ttl: number;
};

export type IncrementCounterWithTokens = (
  params: IncrementTokensParams
) => Promise<void>;
