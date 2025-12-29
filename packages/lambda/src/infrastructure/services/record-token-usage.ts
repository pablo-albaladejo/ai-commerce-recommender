import type {
  GetCounterRecord,
  IncrementCounterWithTokens,
  PutCounterRecord,
} from '../../application/repositories/counter-repository';
import type { RecordTokenUsage } from '../../application/services/counter-service';

const getCurrentDateUTC = (): string => new Date().toISOString().split('T')[0];

const calculateDailyTTL = (date: string, ttlDays = 7): number => {
  const baseDate = new Date(date + 'T00:00:00.000Z');
  return Math.floor(
    (baseDate.getTime() + ttlDays * 24 * 60 * 60 * 1000) / 1000
  );
};

export const recordTokenUsage =
  (
    getRecord: GetCounterRecord,
    putRecord: PutCounterRecord,
    incrementWithTokens: IncrementCounterWithTokens
  ): RecordTokenUsage =>
  async data => {
    const { userId, tableName, inputTokens, outputTokens } = data;
    const date = getCurrentDateUTC();
    const pk = `${userId}#${date}`;
    const ttl = calculateDailyTTL(date);
    const totalTokens = inputTokens + outputTokens;
    const now = new Date().toISOString();

    const existing = await getRecord(tableName, pk);
    if (existing) {
      await incrementWithTokens({
        tableName,
        key: pk,
        totalTokens,
        inputTokens,
        outputTokens,
        ttl,
      });
    } else {
      await putRecord(tableName, {
        pk,
        user_id: userId,
        date,
        count: totalTokens,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        created_at: now,
        updated_at: now,
        ttl,
      });
    }
  };
