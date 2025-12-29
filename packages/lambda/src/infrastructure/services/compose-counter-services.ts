import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type {
  CheckDailyCounter,
  CheckRateLimit,
  RecordTokenUsage,
} from '../../application/services/counter-service';
import { getCounterRecord } from '../repositories/get-counter-record';
import { incrementCounterRecord } from '../repositories/increment-counter-record';
import { incrementCounterWithTokens } from '../repositories/increment-counter-with-tokens';
import { putCounterRecord } from '../repositories/put-counter-record';
import { checkDailyCounter as createCheckDailyCounter } from './check-daily-counter';
import { checkRateLimit as createCheckRateLimit } from './check-rate-limit';
import { recordTokenUsage as createRecordTokenUsage } from './record-token-usage';

/**
 * Counter services composed with injected DynamoDB client
 */
export type CounterServices = {
  checkRateLimit: CheckRateLimit;
  checkDailyCounter: CheckDailyCounter;
  recordTokenUsage: RecordTokenUsage;
};

/**
 * Compose all counter services with a DynamoDB client
 * This is the pure composition function - no side effects, no singletons
 */
export const composeCounterServices = (
  client: DynamoDBDocumentClient
): CounterServices => {
  // Create repository functions
  const getRecord = getCounterRecord(client);
  const putRecord = putCounterRecord(client);
  const incrementRecord = incrementCounterRecord(client);
  const incrementWithTokens = incrementCounterWithTokens(client);

  // Create service functions
  return {
    checkRateLimit: createCheckRateLimit(getRecord, putRecord, incrementRecord),
    checkDailyCounter: createCheckDailyCounter(
      getRecord,
      putRecord,
      incrementRecord
    ),
    recordTokenUsage: createRecordTokenUsage(
      getRecord,
      putRecord,
      incrementWithTokens
    ),
  };
};
