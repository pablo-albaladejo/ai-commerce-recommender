import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { incrementCounterRecord } from './increment-counter-record';

describe('incrementCounterRecord', () => {
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

  test('increments counter with conditional check', async () => {
    mockSend.mockResolvedValue({});

    const fn = incrementCounterRecord(mockClient);
    await fn({
      tableName: 'test-table',
      key: 'test-key',
      increment: 1,
      ttl: 123456,
      limit: 10,
    });

    expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
  });

  test('passes correct parameters', async () => {
    mockSend.mockResolvedValue({});

    const fn = incrementCounterRecord(mockClient);
    await fn({
      tableName: 'my-table',
      key: 'my-key',
      increment: 2,
      ttl: 999999,
      limit: 100,
    });

    const command = mockSend.mock.calls[0][0];
    expect(command.input.TableName).toBe('my-table');
    expect(command.input.Key).toEqual({ pk: 'my-key' });
    expect(command.input.ExpressionAttributeValues[':inc']).toBe(2);
    expect(command.input.ExpressionAttributeValues[':ttl']).toBe(999999);
    expect(command.input.ExpressionAttributeValues[':limit']).toBe(100);
    expect(command.input.ConditionExpression).toBe('#count < :limit');
  });
});
