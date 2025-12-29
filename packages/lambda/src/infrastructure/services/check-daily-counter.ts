import type {
  GetCounterRecord,
  IncrementCounterRecord,
  PutCounterRecord,
} from '../../application/repositories/counter-repository';
import type { CheckDailyCounter } from '../../application/services/counter-service';
import type { CounterResult } from '../../domain/counter';

const getCurrentDateUTC = (): string => new Date().toISOString().split('T')[0];

const getNextMidnightUTC = (): string => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
};

const calculateDailyTTL = (date: string, ttlDays = 7): number => {
  const baseDate = new Date(date + 'T00:00:00.000Z');
  return Math.floor(
    (baseDate.getTime() + ttlDays * 24 * 60 * 60 * 1000) / 1000
  );
};

const createDailyResult = (params: {
  allowed: boolean;
  current: number;
  limit: number;
  resetTime: string;
}): CounterResult => ({
  allowed: params.allowed,
  current: params.current,
  limit: params.limit,
  remaining: Math.max(0, params.limit - params.current),
  resetTime: params.resetTime,
});

export const checkDailyCounter =
  (
    getRecord: GetCounterRecord,
    putRecord: PutCounterRecord,
    incrementRecord: IncrementCounterRecord
  ): CheckDailyCounter =>
  async (userId, config, increment = 1) => {
    const { tableName, limit, ttlDays = 7 } = config;
    const date = getCurrentDateUTC();
    const pk = `${userId}#${date}`;
    const ttl = calculateDailyTTL(date, ttlDays);
    const resetTime = getNextMidnightUTC();

    try {
      const existing = await getRecord(tableName, pk);
      const currentCount = (existing?.count ?? 0) + increment;
      const allowed = currentCount <= limit;

      if (allowed) {
        const now = new Date().toISOString();
        if (existing) {
          await incrementRecord({ tableName, key: pk, increment, ttl, limit });
        } else {
          await putRecord(tableName, {
            pk,
            user_id: userId,
            date,
            count: increment,
            created_at: now,
            updated_at: now,
            ttl,
          });
        }
      }

      return createDailyResult({
        allowed,
        current: currentCount,
        limit,
        resetTime,
      });
    } catch {
      // Fail open on error
      return createDailyResult({
        allowed: true,
        current: increment,
        limit,
        resetTime,
      });
    }
  };
