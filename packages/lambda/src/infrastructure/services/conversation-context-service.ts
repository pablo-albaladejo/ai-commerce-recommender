import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  AddConversationMessage,
  GetConversationContext,
} from '../../application/services/conversation-service';

// ============================================================================
// Token Estimation
// ============================================================================

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

// ============================================================================
// Configuration
// ============================================================================

export type ConversationServiceConfig = {
  tableName: string;
  maxMessages: number;
  maxTokens: number;
  ttlHours: number;
};

const createKey = (userId: number, chatId: number): string =>
  `${userId}#${chatId}`;

const calculateTTL = (ttlHours: number): number =>
  Math.floor(Date.now() / 1000) + ttlHours * 3600;

// ============================================================================
// Service Factories (pure functions)
// ============================================================================

/**
 * Create getConversationContext function
 */
export const createGetConversationContext = (
  client: DynamoDBDocumentClient,
  tableName: string
): GetConversationContext => {
  return async (userId, chatId) => {
    try {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: createKey(userId, chatId) },
        })
      );

      if (!result.Item) return null;

      return {
        messages: result.Item.messages || [],
        summary: result.Item.summary,
        totalTokens: result.Item.total_tokens || 0,
      };
    } catch {
      return null;
    }
  };
};

// ============================================================================
// Message Processing Helpers
// ============================================================================

type MessageState = {
  messages: Array<{ role: string; content: string; tokenCount?: number }>;
  totalTokens: number;
  summary?: string;
};

const compressOldMessages = (
  state: MessageState,
  maxMessages: number
): MessageState => {
  if (state.messages.length <= maxMessages) return state;

  const oldMessages = state.messages.slice(
    0,
    state.messages.length - maxMessages
  );
  const oldSummary = oldMessages
    .map(m => `${m.role}: ${m.content.slice(0, 50)}...`)
    .join('\n');

  const newSummary = state.summary
    ? `${state.summary}\n${oldSummary}`
    : oldSummary;
  const recentMessages = state.messages.slice(-maxMessages);
  const recentTokens = recentMessages.reduce(
    (sum, m) => sum + (m.tokenCount || 0),
    0
  );

  return {
    messages: recentMessages,
    totalTokens: recentTokens + (newSummary ? estimateTokens(newSummary) : 0),
    summary: newSummary,
  };
};

type SaveContextParams = {
  client: DynamoDBDocumentClient;
  config: ConversationServiceConfig;
  pk: string;
  userId: number;
  chatId: number;
  state: MessageState;
  isUpdate: boolean;
};

const saveContext = async (params: SaveContextParams): Promise<void> => {
  const { client, config, pk, userId, chatId, state, isUpdate } = params;
  const ttl = calculateTTL(config.ttlHours);
  const now = new Date().toISOString();

  if (isUpdate) {
    await client.send(
      new UpdateCommand({
        TableName: config.tableName,
        Key: { pk },
        UpdateExpression: `SET messages = :messages, total_tokens = :tokens, updated_at = :now, #ttl = :ttl${state.summary ? ', summary = :summary' : ''}`,
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':messages': state.messages,
          ':tokens': state.totalTokens,
          ':now': now,
          ':ttl': ttl,
          ...(state.summary && { ':summary': state.summary }),
        },
      })
    );
  } else {
    await client.send(
      new PutCommand({
        TableName: config.tableName,
        Item: {
          pk,
          user_id: userId,
          chat_id: chatId,
          messages: state.messages,
          total_tokens: state.totalTokens,
          summary: state.summary,
          created_at: now,
          updated_at: now,
          ttl,
        },
      })
    );
  }
};

/**
 * Create addConversationMessage function
 */
export const createAddConversationMessage = (
  client: DynamoDBDocumentClient,
  config: ConversationServiceConfig,
  getContext: GetConversationContext
): AddConversationMessage => {
  return async (userId, chatId, message) => {
    const pk = createKey(userId, chatId);

    const messageWithTokens = {
      ...message,
      tokenCount: message.tokenCount ?? estimateTokens(message.content),
    };

    try {
      const current = await getContext(userId, chatId);

      let state: MessageState = {
        messages: [...(current?.messages || []), messageWithTokens],
        totalTokens: (current?.totalTokens || 0) + messageWithTokens.tokenCount,
        summary: current?.summary,
      };

      state = compressOldMessages(state, config.maxMessages);

      await saveContext({
        client,
        config,
        pk,
        userId,
        chatId,
        state,
        isUpdate: !!current,
      });
    } catch {
      // Silent fail - context is not critical
    }
  };
};
