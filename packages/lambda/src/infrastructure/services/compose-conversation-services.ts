import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type {
  AddConversationMessage,
  GetConversationContext,
} from '../../application/services/conversation-service';
import {
  createAddConversationMessage,
  createGetConversationContext,
} from './conversation-context-service';

/**
 * Conversation services composed with injected DynamoDB client
 */
export type ConversationServices = {
  getContext: GetConversationContext;
  addMessage: AddConversationMessage;
};

/**
 * Configuration for conversation services
 */
export type ConversationServicesConfig = {
  tableName: string;
  maxMessages?: number;
  maxTokens?: number;
  ttlHours?: number;
};

/**
 * Compose all conversation services with a DynamoDB client
 */
export const composeConversationServices = (
  client: DynamoDBDocumentClient,
  config: ConversationServicesConfig
): ConversationServices => {
  const fullConfig = {
    tableName: config.tableName,
    maxMessages: config.maxMessages ?? 6,
    maxTokens: config.maxTokens ?? 4000,
    ttlHours: config.ttlHours ?? 24,
  };

  const getContext = createGetConversationContext(client, fullConfig.tableName);
  const addMessage = createAddConversationMessage(
    client,
    fullConfig,
    getContext
  );

  return { getContext, addMessage };
};
