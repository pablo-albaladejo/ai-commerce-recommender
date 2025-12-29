import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type {
  CounterRecord,
  GetCounterRecord,
} from '../../application/repositories/counter-repository';

export const getCounterRecord =
  (client: DynamoDBDocumentClient): GetCounterRecord =>
  async (tableName, key) => {
    const result = await client.send(
      new GetCommand({ TableName: tableName, Key: { pk: key } })
    );
    return (result.Item as CounterRecord) ?? null;
  };
