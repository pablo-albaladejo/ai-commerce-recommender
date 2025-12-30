import { type Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
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

// ============================================================================
// Response helpers
// ============================================================================

type ErrorResponseParams = {
  statusCode: number;
  code: string;
  message: string;
  traceId?: string;
  headers?: Record<string, string>;
};

export const createErrorResponse = (params: ErrorResponseParams) => ({
  statusCode: params.statusCode,
  body: JSON.stringify({
    success: false,
    error: { code: params.code, message: params.message },
    ...(params.traceId && { trace_id: params.traceId }),
  }),
  headers: {
    'Content-Type': 'application/json',
    ...(params.traceId && { 'X-Trace-Id': params.traceId }),
    ...params.headers,
  },
});

export const calculateDurationMs = (
  startTimestamp: string | undefined
): number | undefined => {
  if (!startTimestamp) return undefined;
  const start = Date.parse(startTimestamp);
  if (Number.isNaN(start)) return undefined;
  return Date.now() - start;
};

// ============================================================================
// Error mapping
// ============================================================================

const recordMetric = (metrics: Metrics | undefined, name: string) =>
  metrics?.addMetric(name, MetricUnit.Count, 1);

const isValidationError = (error: Error): boolean =>
  error?.name === 'ValidationError' || error?.name === 'ZodError';

const isAiSdkError = (error: Error): boolean => error?.name?.startsWith('AI_');

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

type MapErrorParams = {
  error: Error;
  translator: TranslationService;
  traceId?: string;
  metrics?: Metrics;
};

const mapAiSdkErrorToResponse = ({
  error,
  translator,
  traceId,
  metrics,
}: MapErrorParams) => {
  if (!isAiSdkError(error)) return null;
  recordMetric(metrics, 'AiSdkErrorHandled');
  // Telegram expects 200 OK to stop retries; body still carries error information.
  return createErrorResponse({
    statusCode: 200,
    code: 'LLM_ERROR',
    message: translator.t('error.internal'),
    traceId,
  });
};

const mapDomainErrorToResponse = ({
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
  return null;
};

const mapValidationErrorToResponse = ({
  error,
  translator,
  traceId,
  metrics,
}: MapErrorParams) => {
  if (!isValidationError(error)) return null;
  recordMetric(metrics, 'ValidationErrorHandled');
  return createErrorResponse({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: translator.t('error.validation'),
    traceId,
  });
};

const mapUnknownErrorToResponse = ({
  translator,
  traceId,
  metrics,
}: MapErrorParams) => {
  recordMetric(metrics, 'UnknownErrorHandled');
  return createErrorResponse({
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: translator.t('error.internal'),
    traceId,
  });
};

export const mapErrorToResponse = (params: MapErrorParams) => {
  return (
    mapAiSdkErrorToResponse(params) ??
    mapDomainErrorToResponse(params) ??
    mapValidationErrorToResponse(params) ??
    mapUnknownErrorToResponse(params)
  );
};
