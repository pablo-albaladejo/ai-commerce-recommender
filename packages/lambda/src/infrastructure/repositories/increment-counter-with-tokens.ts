import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type {
  IncrementCounterWithTokens,
  IncrementTokensParams,
} from '../../application/repositories/counter-repository';

const buildTokenIncrementCommand = (params: IncrementTokensParams) =>
  new UpdateCommand({
    TableName: params.tableName,
    Key: { pk: params.key },
    UpdateExpression:
      'ADD #count :total, input_tokens :input, output_tokens :output SET updated_at = :now, #ttl = :ttl',
    ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':total': params.totalTokens,
      ':input': params.inputTokens,
      ':output': params.outputTokens,
      ':now': new Date().toISOString(),
      ':ttl': params.ttl,
    },
  });

export const incrementCounterWithTokens =
  (client: DynamoDBDocumentClient): IncrementCounterWithTokens =>
  async params => {
    await client.send(buildTokenIncrementCommand(params));
  };
