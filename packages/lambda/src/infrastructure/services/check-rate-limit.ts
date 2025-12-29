import type {
  GetCounterRecord,
  IncrementCounterRecord,
  PutCounterRecord,
} from '../../application/repositories/counter-repository';
import type { CheckRateLimit } from '../../application/services/counter-service';
import type { CounterResult } from '../../domain/counter';

const createRateLimitResult = (params: {
  allowed: boolean;
  current: number;
  limit: number;
  resetTime: number;
  now: number;
}): CounterResult => ({
  allowed: params.allowed,
  current: params.current,
  limit: params.limit,
  remaining: Math.max(0, params.limit - params.current),
  resetTime: params.resetTime,
  retryAfter: params.allowed
    ? undefined
    : Math.max(0, params.resetTime - params.now),
});

type UpdateCounterParams = {
  getRecord: GetCounterRecord;
  putRecord: PutCounterRecord;
  incrementRecord: IncrementCounterRecord;
  tableName: string;
  key: string;
  windowStart: number;
  ttl: number;
  limit: number;
  existing: Awaited<ReturnType<GetCounterRecord>>;
};

const updateCounter = async (params: UpdateCounterParams): Promise<void> => {
  const {
    existing,
    incrementRecord,
    putRecord,
    tableName,
    key,
    ttl,
    limit,
    windowStart,
  } = params;
  const isSameWindow = existing?.window_start === windowStart;

  if (existing && isSameWindow) {
    await incrementRecord({ tableName, key, increment: 1, ttl, limit });
  } else {
    await putRecord(tableName, {
      pk: key,
      count: 1,
      window_start: windowStart,
      ttl,
    });
  }
};

export const checkRateLimit =
  (
    getRecord: GetCounterRecord,
    putRecord: PutCounterRecord,
    incrementRecord: IncrementCounterRecord
  ): CheckRateLimit =>
  async (key, config) => {
    const { tableName, limit, windowSeconds = 60 } = config;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
    const ttl = windowStart + windowSeconds + 60;
    const resetTime = windowStart + windowSeconds;

    try {
      const existing = await getRecord(tableName, key);
      const isSameWindow = existing?.window_start === windowStart;
      const currentCount = isSameWindow ? (existing?.count ?? 0) + 1 : 1;
      const allowed = currentCount <= limit;

      if (allowed) {
        await updateCounter({
          getRecord,
          putRecord,
          incrementRecord,
          tableName,
          key,
          windowStart,
          ttl,
          limit,
          existing,
        });
      }

      return createRateLimitResult({
        allowed,
        current: currentCount,
        limit,
        resetTime,
        now,
      });
    } catch {
      return createRateLimitResult({
        allowed: true,
        current: 0,
        limit,
        resetTime,
        now,
      });
    }
  };
