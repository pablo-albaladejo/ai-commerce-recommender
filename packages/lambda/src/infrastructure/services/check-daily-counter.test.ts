import { checkDailyCounter } from './check-daily-counter';

describe('checkDailyCounter', () => {
  const mockGetRecord = jest.fn();
  const mockPutRecord = jest.fn();
  const mockIncrementRecord = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('allows request when under limit', async () => {
    mockGetRecord.mockResolvedValue({
      pk: '12345#2024-01-15',
      count: 50,
    });

    const fn = checkDailyCounter(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn(12345, {
      tableName: 'test-table',
      limit: 100,
    });

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(51);
    expect(result.remaining).toBe(49);
  });

  test('denies request when at limit', async () => {
    mockGetRecord.mockResolvedValue({
      pk: '12345#2024-01-15',
      count: 100,
    });

    const fn = checkDailyCounter(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn(12345, {
      tableName: 'test-table',
      limit: 100,
    });

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(101);
    expect(result.remaining).toBe(0);
  });

  test('creates new record for new user', async () => {
    mockGetRecord.mockResolvedValue(null);
    mockPutRecord.mockResolvedValue(undefined);

    const fn = checkDailyCounter(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn(12345, {
      tableName: 'test-table',
      limit: 100,
    });

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(mockPutRecord).toHaveBeenCalledWith(
      'test-table',
      expect.objectContaining({
        pk: '12345#2024-01-15',
        user_id: 12345,
        date: '2024-01-15',
        count: 1,
      })
    );
  });

  test('increments existing record', async () => {
    mockGetRecord.mockResolvedValue({
      pk: '12345#2024-01-15',
      count: 50,
    });
    mockIncrementRecord.mockResolvedValue(undefined);

    const fn = checkDailyCounter(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    await fn(12345, {
      tableName: 'test-table',
      limit: 100,
    });

    expect(mockIncrementRecord).toHaveBeenCalled();
    expect(mockPutRecord).not.toHaveBeenCalled();
  });

  test('uses custom increment value', async () => {
    mockGetRecord.mockResolvedValue({
      pk: '12345#2024-01-15',
      count: 50,
    });

    const fn = checkDailyCounter(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn(12345, { tableName: 'test-table', limit: 100 }, 10);

    expect(result.current).toBe(60);
  });

  test('fails open on error', async () => {
    mockGetRecord.mockRejectedValue(new Error('DB error'));

    const fn = checkDailyCounter(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn(12345, {
      tableName: 'test-table',
      limit: 100,
    });

    expect(result.allowed).toBe(true);
  });

  test('returns reset time as next midnight UTC', async () => {
    mockGetRecord.mockResolvedValue(null);
    mockPutRecord.mockResolvedValue(undefined);

    const fn = checkDailyCounter(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn(12345, {
      tableName: 'test-table',
      limit: 100,
    });

    expect(result.resetTime).toBe('2024-01-16T00:00:00.000Z');
  });
});
