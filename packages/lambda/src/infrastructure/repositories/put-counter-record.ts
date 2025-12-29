import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { PutCounterRecord } from '../../application/repositories/counter-repository';

export const putCounterRecord =
  (client: DynamoDBDocumentClient): PutCounterRecord =>
  async (tableName, record) => {
    await client.send(new PutCommand({ TableName: tableName, Item: record }));
  };
