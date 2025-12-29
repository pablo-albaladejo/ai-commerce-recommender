import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  IncrementCounterRecord,
  IncrementCounterParams,
} from '../../application/repositories/counter-repository';

const buildIncrementCommand = (params: IncrementCounterParams) =>
  new UpdateCommand({
    TableName: params.tableName,
    Key: { pk: params.key },
    UpdateExpression: 'ADD #count :inc SET updated_at = :now, #ttl = :ttl',
    ConditionExpression: '#count < :limit',
    ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':inc': params.increment,
      ':now': new Date().toISOString(),
      ':ttl': params.ttl,
      ':limit': params.limit,
    },
  });

export const incrementCounterRecord =
  (client: DynamoDBDocumentClient): IncrementCounterRecord =>
  async params => {
    await client.send(buildIncrementCommand(params));
  };
