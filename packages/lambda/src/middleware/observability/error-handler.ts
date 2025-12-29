import type { Logger } from '@aws-lambda-powertools/logger';
import { type Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import middy from '@middy/core';
import type {
  TranslationKey,
  TranslationService,
} from '../../application/services/translation-service';
import {
  DailyQuotaError,
  RateLimitError,
  SignatureValidationError,
  TokenBudgetError,
} from '../../domain/errors';
import { defaultTranslationService } from '../../infrastructure/i18n/translation-service';
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

type RateLimitErrorParams = {
  error: RateLimitError;
  translator: TranslationService;
  traceId?: string;
};

const handleRateLimitError = ({
  error,
  translator,
  traceId,
}: RateLimitErrorParams) =>
  createErrorResponse({
    statusCode: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: translator.t('error.rateLimited', {
      retryAfter: error.info.retryAfter || 60,
    }),
    traceId,
    headers: {
      'Retry-After': String(error.info.retryAfter || 60),
      'X-RateLimit-Limit': String(error.info.limit),
      'X-RateLimit-Remaining': String(error.info.remaining),
    },
  });

type QuotaErrorParams = {
  error: DailyQuotaError | TokenBudgetError;
  code: string;
  translationKey: TranslationKey;
  translator: TranslationService;
  traceId?: string;
};

const handleQuotaError = ({
  error,
  code,
  translationKey,
  translator,
  traceId,
}: QuotaErrorParams) =>
  createErrorResponse({
    statusCode: 429,
    code,
    message: translator.t(translationKey, {
      limit: error.info.limit,
      resetTime: error.info.resetTime,
    }),
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

        // Get translation service from context or use default
        const translator = ctx.translationService || defaultTranslationService;

        logger?.error('Request error', {
          operation: 'handle-error',
          traceId,
          component,
          locale: translator.getLocale(),
          error: { name: error?.name, message: error?.message },
        });

        request.response = mapErrorToResponse({
          error,
          translator,
          traceId,
          metrics,
        });
      },
    };
  };

const recordMetric = (metrics: Metrics | undefined, name: string) =>
  metrics?.addMetric(name, MetricUnit.Count, 1);

const isValidationError = (error: Error): boolean =>
  error?.name === 'ValidationError' || error?.name === 'ZodError';

type MapErrorParams = {
  error: Error;
  translator: TranslationService;
  traceId?: string;
  metrics?: Metrics;
};

const mapErrorToResponse = ({
  error,
  translator,
  traceId,
  metrics,
}: MapErrorParams) => {
  if (error instanceof RateLimitError) {
    recordMetric(metrics, 'RateLimitErrorHandled');
    return handleRateLimitError({ error, translator, traceId });
  }
  if (error instanceof DailyQuotaError) {
    recordMetric(metrics, 'DailyQuotaErrorHandled');
    return handleQuotaError({
      error,
      code: 'DAILY_QUOTA_EXCEEDED',
      translationKey: 'error.dailyQuotaExceeded',
      translator,
      traceId,
    });
  }
  if (error instanceof TokenBudgetError) {
    recordMetric(metrics, 'TokenBudgetErrorHandled');
    return handleQuotaError({
      error,
      code: 'TOKEN_BUDGET_EXCEEDED',
      translationKey: 'error.tokenBudgetExceeded',
      translator,
      traceId,
    });
  }
  if (error instanceof SignatureValidationError) {
    recordMetric(metrics, 'SignatureErrorHandled');
    return createErrorResponse({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: translator.t('error.unauthorized'),
      traceId,
    });
  }
  if (isValidationError(error)) {
    recordMetric(metrics, 'ValidationErrorHandled');
    return createErrorResponse({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: translator.t('error.validation'),
      traceId,
    });
  }

  recordMetric(metrics, 'UnknownErrorHandled');
  return createErrorResponse({
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: translator.t('error.internal'),
    traceId,
  });
};

export const comprehensiveErrorHandler = errorHandlerMiddleware;
