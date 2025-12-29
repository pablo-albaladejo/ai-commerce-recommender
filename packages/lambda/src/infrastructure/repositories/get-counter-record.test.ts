import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getCounterRecord } from './get-counter-record';

describe('getCounterRecord', () => {
  const mockSend = jest.fn();
  const mockClient = { send: mockSend } as unknown as DynamoDBDocumentClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns record when found', async () => {
    const record = { pk: 'test-key', count: 5, ttl: 123456 };
    mockSend.mockResolvedValue({ Item: record });

    const fn = getCounterRecord(mockClient);
    const result = await fn('test-table', 'test-key');

    expect(result).toEqual(record);
    expect(mockSend).toHaveBeenCalledWith(expect.any(GetCommand));
  });

  test('returns null when record not found', async () => {
    mockSend.mockResolvedValue({ Item: undefined });

    const fn = getCounterRecord(mockClient);
    const result = await fn('test-table', 'test-key');

    expect(result).toBeNull();
  });

  test('passes correct TableName and Key', async () => {
    mockSend.mockResolvedValue({ Item: null });

    const fn = getCounterRecord(mockClient);
    await fn('my-table', 'my-key');

    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual({
      TableName: 'my-table',
      Key: { pk: 'my-key' },
    });
  });
});
