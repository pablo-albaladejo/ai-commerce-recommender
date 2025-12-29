import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { incrementCounterWithTokens } from './increment-counter-with-tokens';

describe('incrementCounterWithTokens', () => {
  const mockSend = jest.fn();
  const mockClient = { send: mockSend } as unknown as DynamoDBDocumentClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('increments with token breakdown', async () => {
    mockSend.mockResolvedValue({});

    const fn = incrementCounterWithTokens(mockClient);
    await fn({
      tableName: 'test-table',
      key: 'test-key',
      totalTokens: 500,
      inputTokens: 300,
      outputTokens: 200,
      ttl: 123456,
    });

    expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
  });

  test('passes correct token values', async () => {
    mockSend.mockResolvedValue({});

    const fn = incrementCounterWithTokens(mockClient);
    await fn({
      tableName: 'my-table',
      key: 'my-key',
      totalTokens: 1000,
      inputTokens: 600,
      outputTokens: 400,
      ttl: 999999,
    });

    const command = mockSend.mock.calls[0][0];
    expect(command.input.TableName).toBe('my-table');
    expect(command.input.Key).toEqual({ pk: 'my-key' });
    expect(command.input.ExpressionAttributeValues[':total']).toBe(1000);
    expect(command.input.ExpressionAttributeValues[':input']).toBe(600);
    expect(command.input.ExpressionAttributeValues[':output']).toBe(400);
    expect(command.input.ExpressionAttributeValues[':ttl']).toBe(999999);
  });
});
