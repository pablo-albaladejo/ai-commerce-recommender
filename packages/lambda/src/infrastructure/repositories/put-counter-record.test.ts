import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { putCounterRecord } from './put-counter-record';

describe('putCounterRecord', () => {
  const mockSend = jest.fn();
  const mockClient = { send: mockSend } as unknown as DynamoDBDocumentClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('puts record to DynamoDB', async () => {
    mockSend.mockResolvedValue({});

    const record = { pk: 'test-key', count: 1, ttl: 123456 };
    const fn = putCounterRecord(mockClient);
    await fn('test-table', record);

    expect(mockSend).toHaveBeenCalledWith(expect.any(PutCommand));
  });

  test('passes correct TableName and Item', async () => {
    mockSend.mockResolvedValue({});

    const record = { pk: 'my-key', count: 5, window_start: 1000, ttl: 2000 };
    const fn = putCounterRecord(mockClient);
    await fn('my-table', record);

    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual({
      TableName: 'my-table',
      Item: record,
    });
  });
});
