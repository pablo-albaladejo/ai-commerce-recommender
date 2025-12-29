import { recordTokenUsage } from './record-token-usage';

describe('recordTokenUsage', () => {
  const mockGetRecord = jest.fn();
  const mockPutRecord = jest.fn();
  const mockIncrementWithTokens = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('creates new record for new user', async () => {
    mockGetRecord.mockResolvedValue(null);
    mockPutRecord.mockResolvedValue(undefined);

    const fn = recordTokenUsage(
      mockGetRecord,
      mockPutRecord,
      mockIncrementWithTokens
    );
    await fn({
      userId: 12345,
      tableName: 'test-table',
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(mockPutRecord).toHaveBeenCalledWith(
      'test-table',
      expect.objectContaining({
        pk: '12345#2024-01-15',
        user_id: 12345,
        date: '2024-01-15',
        count: 150,
        input_tokens: 100,
        output_tokens: 50,
      })
    );
  });

  test('increments existing record with tokens', async () => {
    mockGetRecord.mockResolvedValue({
      pk: '12345#2024-01-15',
      count: 500,
    });
    mockIncrementWithTokens.mockResolvedValue(undefined);

    const fn = recordTokenUsage(
      mockGetRecord,
      mockPutRecord,
      mockIncrementWithTokens
    );
    await fn({
      userId: 12345,
      tableName: 'test-table',
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(mockIncrementWithTokens).toHaveBeenCalledWith({
      tableName: 'test-table',
      key: '12345#2024-01-15',
      totalTokens: 150,
      inputTokens: 100,
      outputTokens: 50,
      ttl: expect.any(Number),
    });
  });

  test('bubbles up errors to error handler', async () => {
    mockGetRecord.mockRejectedValue(new Error('DB error'));

    const fn = recordTokenUsage(
      mockGetRecord,
      mockPutRecord,
      mockIncrementWithTokens
    );

    // Should throw to let error-handler middleware log and handle it
    await expect(
      fn({
        userId: 12345,
        tableName: 'test-table',
        inputTokens: 100,
        outputTokens: 50,
      })
    ).rejects.toThrow('DB error');
  });
});
