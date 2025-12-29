import { checkRateLimit } from './check-rate-limit';

describe('checkRateLimit', () => {
  const mockGetRecord = jest.fn();
  const mockPutRecord = jest.fn();
  const mockIncrementRecord = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:30.000Z')); // 30 seconds into minute
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('allows request when under limit', async () => {
    mockGetRecord.mockResolvedValue({
      pk: 'test-key',
      count: 3,
      window_start: Math.floor(Date.now() / 1000 / 60) * 60,
    });

    const fn = checkRateLimit(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn('test-key', {
      tableName: 'test-table',
      limit: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(4);
    expect(result.remaining).toBe(6);
  });

  test('denies request when at limit', async () => {
    mockGetRecord.mockResolvedValue({
      pk: 'test-key',
      count: 10,
      window_start: Math.floor(Date.now() / 1000 / 60) * 60,
    });

    const fn = checkRateLimit(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn('test-key', {
      tableName: 'test-table',
      limit: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(11);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test('creates new record for new window', async () => {
    mockGetRecord.mockResolvedValue({
      pk: 'test-key',
      count: 5,
      window_start: 0, // Old window
    });
    mockPutRecord.mockResolvedValue(undefined);

    const fn = checkRateLimit(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn('test-key', {
      tableName: 'test-table',
      limit: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(mockPutRecord).toHaveBeenCalled();
  });

  test('increments existing record in same window', async () => {
    const windowStart = Math.floor(Date.now() / 1000 / 60) * 60;
    mockGetRecord.mockResolvedValue({
      pk: 'test-key',
      count: 3,
      window_start: windowStart,
    });
    mockIncrementRecord.mockResolvedValue(undefined);

    const fn = checkRateLimit(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    await fn('test-key', {
      tableName: 'test-table',
      limit: 10,
      windowSeconds: 60,
    });

    expect(mockIncrementRecord).toHaveBeenCalled();
    expect(mockPutRecord).not.toHaveBeenCalled();
  });

  test('fails open on error', async () => {
    mockGetRecord.mockRejectedValue(new Error('DB error'));

    const fn = checkRateLimit(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn('test-key', {
      tableName: 'test-table',
      limit: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
  });

  test('handles null existing record', async () => {
    mockGetRecord.mockResolvedValue(null);
    mockPutRecord.mockResolvedValue(undefined);

    const fn = checkRateLimit(
      mockGetRecord,
      mockPutRecord,
      mockIncrementRecord
    );
    const result = await fn('test-key', {
      tableName: 'test-table',
      limit: 10,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(mockPutRecord).toHaveBeenCalled();
  });
});
