import type { Context } from 'aws-lambda';
import {
  DailyQuotaError,
  RateLimitError,
  TokenBudgetError,
} from '../../domain/errors';
import {
  APIGatewayProxyEventBuilder,
  LambdaContextBuilder,
} from '../../tests/fixtures/api-event.builder';
import { MiddyRequestBuilder } from '../../tests/fixtures/middy-request.builder';
import { TelegramUpdateBuilder } from '../../tests/fixtures/telegram-message.builder';
import { dailyQuotaMiddleware } from './daily-quota';
import { rateLimiterMiddleware } from './rate-limiter';
import { tokenBudgetMiddleware } from './token-budget';

// Mock dependencies
const mockCheckRateLimit = jest.fn();
const mockCheckDailyCounter = jest.fn();
const mockRecordTokenUsage = jest.fn();
const mockExtractChatId = jest.fn();
const mockExtractUserId = jest.fn();

// Default test table names
const TEST_TABLES = {
  rateLimit: 'test-rate-limits',
  dailyQuota: 'test-daily-quotas',
  tokenBudget: 'test-token-budgets',
};

describe('Abuse Protection Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rateLimiterMiddleware', () => {
    const createMiddleware = (config: {
      tableName: string;
      maxRequests?: number;
      windowSeconds?: number;
    }) =>
      rateLimiterMiddleware({
        checkRateLimit: mockCheckRateLimit,
        extractChatId: mockExtractChatId,
      })(config);

    test('allows request when under rate limit', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.rateLimit,
        maxRequests: 6,
        windowSeconds: 60,
      });

      mockExtractChatId.mockReturnValue('12345');
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        current: 3,
        limit: 6,
        remaining: 3,
        resetTime: Date.now() + 60000,
      });

      const mockRequest = MiddyRequestBuilder.build({
        event: APIGatewayProxyEventBuilder.build({
          body: JSON.stringify(TelegramUpdateBuilder.build()),
        }),
      });

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();

      expect(mockCheckRateLimit).toHaveBeenCalledWith('chat#12345', {
        tableName: TEST_TABLES.rateLimit,
        limit: 6,
        windowSeconds: 60,
      });
    });

    test('throws RateLimitError when rate limit exceeded', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.rateLimit,
        maxRequests: 6,
        windowSeconds: 60,
      });

      mockExtractChatId.mockReturnValue('12345');
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        current: 7,
        limit: 6,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 45,
      });

      const mockRequest = MiddyRequestBuilder.build();

      await expect(middleware.before!(mockRequest)).rejects.toThrow(
        RateLimitError
      );
    });

    test('skips rate limiting when no chat ID available', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.rateLimit,
      });

      mockExtractChatId.mockReturnValue(undefined);

      const mockRequest = MiddyRequestBuilder.build();

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });

    test('adds rate limit headers to response', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.rateLimit,
      });

      mockExtractChatId.mockReturnValue('12345');
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        current: 3,
        limit: 6,
        remaining: 3,
        resetTime: Date.now() + 60000,
      });

      const mockRequest = MiddyRequestBuilder.build({
        response: {
          statusCode: 200,
          body: '{}',
          headers: {} as Record<string, string>,
        },
      });

      await middleware.before!(mockRequest);
      await middleware.after!(mockRequest);

      const response = mockRequest.response as {
        headers: Record<string, string>;
      };
      expect(response.headers['X-RateLimit-Limit']).toBe('6');
      expect(response.headers['X-RateLimit-Remaining']).toBe('3');
    });
  });

  describe('dailyQuotaMiddleware', () => {
    const createMiddleware = (config: {
      tableName: string;
      maxMessages?: number;
    }) =>
      dailyQuotaMiddleware({
        checkDailyQuota: mockCheckDailyCounter,
        extractUserId: mockExtractUserId,
      })(config);

    test('allows request when under daily quota', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.dailyQuota,
        maxMessages: 100,
      });

      mockExtractUserId.mockReturnValue(12345);
      mockCheckDailyCounter.mockResolvedValue({
        allowed: true,
        current: 50,
        limit: 100,
        remaining: 50,
        resetTime: '2022-01-02T00:00:00.000Z',
      });

      const mockRequest = MiddyRequestBuilder.build();

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();

      expect(mockCheckDailyCounter).toHaveBeenCalledWith(12345, {
        tableName: TEST_TABLES.dailyQuota,
        limit: 100,
      });
    });

    test('throws DailyQuotaError when quota exceeded', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.dailyQuota,
        maxMessages: 100,
      });

      mockExtractUserId.mockReturnValue(12345);
      mockCheckDailyCounter.mockResolvedValue({
        allowed: false,
        current: 101,
        limit: 100,
        remaining: 0,
        resetTime: '2022-01-02T00:00:00.000Z',
      });

      const mockRequest = MiddyRequestBuilder.build();

      await expect(middleware.before!(mockRequest)).rejects.toThrow(
        DailyQuotaError
      );
    });

    test('skips quota check when no user ID available', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.dailyQuota,
      });

      mockExtractUserId.mockReturnValue(undefined);

      const mockRequest = MiddyRequestBuilder.build();

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();
      expect(mockCheckDailyCounter).not.toHaveBeenCalled();
    });
  });

  describe('tokenBudgetMiddleware', () => {
    const createMiddleware = (config: {
      tableName: string;
      maxTokens?: number;
      estimatedTokensPerRequest?: number;
    }) =>
      tokenBudgetMiddleware({
        checkDailyQuota: mockCheckDailyCounter,
        recordTokenUsage: mockRecordTokenUsage,
        extractUserId: mockExtractUserId,
      })(config);

    test('allows request when under token budget', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.tokenBudget,
        maxTokens: 30000,
        estimatedTokensPerRequest: 300,
      });

      mockExtractUserId.mockReturnValue(12345);
      mockCheckDailyCounter.mockResolvedValue({
        allowed: true,
        current: 15000,
        limit: 30000,
        remaining: 15000,
        resetTime: '2022-01-02T00:00:00.000Z',
      });

      const mockRequest = MiddyRequestBuilder.build();

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();

      expect(mockCheckDailyCounter).toHaveBeenCalledWith(
        12345,
        { tableName: TEST_TABLES.tokenBudget, limit: 30000 },
        300
      );
    });

    test('throws TokenBudgetError when budget exceeded', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.tokenBudget,
        maxTokens: 30000,
      });

      mockExtractUserId.mockReturnValue(12345);
      mockCheckDailyCounter.mockResolvedValue({
        allowed: false,
        current: 30001,
        limit: 30000,
        remaining: 0,
        resetTime: '2022-01-02T00:00:00.000Z',
      });

      const mockRequest = MiddyRequestBuilder.build();

      await expect(middleware.before!(mockRequest)).rejects.toThrow(
        TokenBudgetError
      );
    });

    test('records actual token usage after request', async () => {
      const middleware = createMiddleware({
        tableName: TEST_TABLES.tokenBudget,
        maxTokens: 30000,
      });

      mockExtractUserId.mockReturnValue(12345);
      mockCheckDailyCounter.mockResolvedValue({
        allowed: true,
        current: 15000,
        limit: 30000,
        remaining: 15000,
        resetTime: '2022-01-02T00:00:00.000Z',
      });

      const context = LambdaContextBuilder.build() as Context & {
        actualTokenUsage?: { inputTokens: number; outputTokens: number };
      };
      context.actualTokenUsage = {
        inputTokens: 150,
        outputTokens: 75,
      };

      const mockRequest = MiddyRequestBuilder.build({
        context,
        response: {
          statusCode: 200,
          body: '{}',
          headers: {},
        },
      });

      await middleware.before!(mockRequest);
      await middleware.after!(mockRequest);

      expect(mockRecordTokenUsage).toHaveBeenCalledWith({
        userId: 12345,
        tableName: TEST_TABLES.tokenBudget,
        inputTokens: 150,
        outputTokens: 75,
      });
    });
  });

  describe('Error classes', () => {
    test('RateLimitError has correct properties', () => {
      const error = new RateLimitError('Rate limit exceeded', {
        retryAfter: 45,
        limit: 6,
        remaining: 0,
      });

      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.info.retryAfter).toBe(45);
      expect(error.info.limit).toBe(6);
      expect(error.info.remaining).toBe(0);
    });

    test('DailyQuotaError has correct properties', () => {
      const error = new DailyQuotaError('Daily quota exceeded', {
        limit: 100,
        used: 101,
        resetTime: '2022-01-02T00:00:00.000Z',
      });

      expect(error.name).toBe('DailyQuotaError');
      expect(error.message).toBe('Daily quota exceeded');
      expect(error.info.limit).toBe(100);
      expect(error.info.used).toBe(101);
      expect(error.info.resetTime).toBe('2022-01-02T00:00:00.000Z');
    });

    test('TokenBudgetError has correct properties', () => {
      const error = new TokenBudgetError('Token budget exceeded', {
        limit: 30000,
        used: 30001,
        resetTime: '2022-01-02T00:00:00.000Z',
      });

      expect(error.name).toBe('TokenBudgetError');
      expect(error.message).toBe('Token budget exceeded');
      expect(error.info.limit).toBe(30000);
      expect(error.info.used).toBe(30001);
      expect(error.info.resetTime).toBe('2022-01-02T00:00:00.000Z');
    });
  });
});
