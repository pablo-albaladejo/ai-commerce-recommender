import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB Document Client singleton
 * Reused across Lambda warm invocations for connection pooling
 */
let client: DynamoDBDocumentClient | null = null;

export const getDynamoDBClient = (): DynamoDBDocumentClient => {
  if (!client) {
    client = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: process.env.AWS_REGION })
    );
  }
  return client;
};

// Re-export type for convenience
export type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
