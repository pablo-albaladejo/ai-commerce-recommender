import type { Logger } from '@aws-lambda-powertools/logger';
import { type Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import middy from '@middy/core';
import {
  DailyQuotaError,
  RateLimitError,
  SignatureValidationError,
  TokenBudgetError,
} from '../../domain/errors';
import type { ExtendedLambdaContext } from '../types/lambda-context';

// ============================================================================
// Types
// ============================================================================

export type ErrorResponse = {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
  trace_id?: string;
};

type ErrorHandlerConfig = { component?: string };
type ErrorHandlerDependencies = { logger?: Logger; metrics?: Metrics };

type ErrorResponseParams = {
  statusCode: number;
  code: string;
  message: string;
  traceId?: string;
  headers?: Record<string, string>;
};

// ============================================================================
// Helpers
// ============================================================================

const createErrorResponse = (params: ErrorResponseParams) => ({
  statusCode: params.statusCode,
  body: JSON.stringify({
    success: false,
    error: { code: params.code, message: params.message },
    ...(params.traceId && { trace_id: params.traceId }),
  } as ErrorResponse),
  headers: {
    'Content-Type': 'application/json',
    ...(params.traceId && { 'X-Trace-Id': params.traceId }),
    ...params.headers,
  },
});

const handleRateLimitError = (error: RateLimitError, traceId?: string) =>
  createErrorResponse({
    statusCode: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: error.message,
    traceId,
    headers: {
      'Retry-After': String(error.info.retryAfter || 60),
      'X-RateLimit-Limit': String(error.info.limit),
      'X-RateLimit-Remaining': String(error.info.remaining),
    },
  });

const handleQuotaError = (
  error: DailyQuotaError | TokenBudgetError,
  code: string,
  traceId?: string
) =>
  createErrorResponse({
    statusCode: 429,
    code,
    message: error.message,
    traceId,
    headers: {
      'Retry-After': '86400',
      [`X-${code.includes('QUOTA') ? 'Daily-Quota' : 'Token-Budget'}-Limit`]:
        String(error.info.limit),
      [`X-${code.includes('QUOTA') ? 'Daily-Quota' : 'Token-Budget'}-Used`]:
        String(error.info.used),
    },
  });

// ============================================================================
// Middleware
// ============================================================================

export const errorHandlerMiddleware =
  (deps: ErrorHandlerDependencies) =>
  (config: ErrorHandlerConfig = {}): middy.MiddlewareObj => {
    const { component = 'error-handler' } = config;
    const { logger, metrics } = deps;

    return {
      onError: async request => {
        const ctx = request.context as unknown as ExtendedLambdaContext;
        const traceId = ctx.trace?.traceId;
        const error = request.error as Error;

        logger?.error('Request error', {
          operation: 'handle-error',
          traceId,
          component,
          error: { name: error?.name, message: error?.message },
        });

        request.response = mapErrorToResponse(error, traceId, metrics);
      },
    };
  };

const recordMetric = (metrics: Metrics | undefined, name: string) =>
  metrics?.addMetric(name, MetricUnit.Count, 1);

const isValidationError = (error: Error): boolean =>
  error?.name === 'ValidationError' || error?.name === 'ZodError';

const mapErrorToResponse = (
  error: Error,
  traceId?: string,
  metrics?: Metrics
) => {
  if (error instanceof RateLimitError) {
    recordMetric(metrics, 'RateLimitErrorHandled');
    return handleRateLimitError(error, traceId);
  }
  if (error instanceof DailyQuotaError) {
    recordMetric(metrics, 'DailyQuotaErrorHandled');
    return handleQuotaError(error, 'DAILY_QUOTA_EXCEEDED', traceId);
  }
  if (error instanceof TokenBudgetError) {
    recordMetric(metrics, 'TokenBudgetErrorHandled');
    return handleQuotaError(error, 'TOKEN_BUDGET_EXCEEDED', traceId);
  }
  if (error instanceof SignatureValidationError) {
    recordMetric(metrics, 'SignatureErrorHandled');
    return createErrorResponse({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: error.message,
      traceId,
    });
  }
  if (isValidationError(error)) {
    recordMetric(metrics, 'ValidationErrorHandled');
    return createErrorResponse({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: error.message,
      traceId,
    });
  }

  recordMetric(metrics, 'UnknownErrorHandled');
  return createErrorResponse({
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    traceId,
  });
};

export const comprehensiveErrorHandler = errorHandlerMiddleware;
