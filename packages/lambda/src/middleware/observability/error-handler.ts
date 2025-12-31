import type { Logger } from '@aws-lambda-powertools/logger';
import type { Metrics } from '@aws-lambda-powertools/metrics';
import middy from '@middy/core';
import { defaultTranslationService } from '../../infrastructure/i18n/translation-service';
import type { ExtendedLambdaContext } from '../types/lambda-context';
import {
  calculateDurationMs,
  mapErrorToResponse,
  mapErrorToUserMessage,
} from './error-handler.logic';

type ErrorLogDetails = {
  name: string;
  message: string;
  stack?: string;
  statusCode?: number;
  url?: string;
  responseBodyLength?: number;
  cause?: { name: string; message: string };
};

const MAX_LOGGED_ERROR_MESSAGE_LENGTH = 500;

const normalizeLogMessage = (message: string): string =>
  message.replace(/\s+/g, ' ').trim();

const redactAiSdkTypeValidationValue = (message: string): string => {
  // AI SDK type validation errors can include full model output JSON. That can leak content, so we redact
  // the "Value: ..." section and keep only the structured error details.
  if (!message.includes('Type validation failed:')) return message;

  const marker = 'Error message:';
  const markerIndex = message.indexOf(marker);
  if (markerIndex === -1) return message;

  const errorDetails = message.slice(markerIndex).trim();
  return `Type validation failed. ${errorDetails}`;
};

const sanitizeErrorTextForLogging = (message: string): string => {
  const redacted = redactAiSdkTypeValidationValue(message);
  const normalized = normalizeLogMessage(redacted);
  if (normalized.length <= MAX_LOGGED_ERROR_MESSAGE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_LOGGED_ERROR_MESSAGE_LENGTH)}…`;
};

const sanitizeErrorStackForLogging = (
  stack: string | undefined,
  errorName: string,
  sanitizedMessage: string
): string | undefined => {
  if (!stack) return undefined;
  const lines = stack.split('\n');
  if (lines.length === 0) return undefined;
  lines[0] = `${errorName}: ${sanitizedMessage}`;
  return lines.join('\n');
};

const buildErrorLogDetails = (error: Error): ErrorLogDetails => {
  const sanitizedMessage = sanitizeErrorTextForLogging(error.message);

  const details: ErrorLogDetails = {
    name: error.name,
    message: sanitizedMessage,
    stack: sanitizeErrorStackForLogging(
      error.stack,
      error.name,
      sanitizedMessage
    ),
  };

  const anyError = error as unknown as Record<string, unknown>;

  const statusCode = anyError.statusCode;
  if (typeof statusCode === 'number') {
    details.statusCode = statusCode;
  }

  const url = anyError.url;
  if (typeof url === 'string') {
    details.url = url;
  }

  const responseBody = anyError.responseBody;
  if (typeof responseBody === 'string') {
    details.responseBodyLength = responseBody.length;
  } else if (responseBody instanceof Uint8Array) {
    details.responseBodyLength = responseBody.byteLength;
  }

  const cause = (error as unknown as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    details.cause = {
      name: cause.name,
      message: sanitizeErrorTextForLogging(cause.message),
    };
  }

  return details;
};

// ============================================================================
// Types
// ============================================================================

export type ErrorResponse = {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
  trace_id?: string;
};

export type NotifyUserParams = {
  message: string;
  request: middy.Request;
  traceId?: string;
};

export type NotifyUser = (params: NotifyUserParams) => Promise<void>;

type ErrorHandlerConfig = { component?: string };
type ErrorHandlerDependencies = {
  logger?: Logger;
  metrics?: Metrics;
  notifyUser?: NotifyUser;
};

type NotifyUserSafelyParams = {
  notifyUser: NotifyUser;
  message: string;
  request: middy.Request;
  traceId?: string;
  logger?: Logger;
  requestId?: string;
  component: string;
};

const notifyUserSafely = async (
  params: NotifyUserSafelyParams
): Promise<void> => {
  const {
    notifyUser,
    message,
    request,
    traceId,
    logger,
    requestId,
    component,
  } = params;

  try {
    await notifyUser({ message, request, traceId });
  } catch (notifyError) {
    logger?.warn('Failed to notify user', {
      traceId,
      requestId,
      component,
      notifyError: {
        name: notifyError instanceof Error ? notifyError.name : 'UnknownError',
        message:
          notifyError instanceof Error ? notifyError.message : 'Unknown error',
      },
    });
  }
};

// ============================================================================
// Middleware
// ============================================================================

export const errorHandlerMiddleware =
  (deps: ErrorHandlerDependencies) =>
  (config: ErrorHandlerConfig = {}): middy.MiddlewareObj => {
    const { component = 'error-handler' } = config;
    const { logger, metrics, notifyUser } = deps;

    return {
      onError: async request => {
        const ctx = request.context as unknown as ExtendedLambdaContext;
        const traceId = ctx.trace?.traceId;
        const requestId = ctx.trace?.requestId;
        const duration = calculateDurationMs(ctx.trace?.timestamp);
        const error = request.error as Error;

        // Get translation service from context or use default
        const translator = ctx.translationService || defaultTranslationService;

        logger?.error('Request error', {
          operation: 'handle-error',
          traceId,
          requestId,
          component,
          duration,
          locale: translator.getLocale(),
          error: buildErrorLogDetails(error),
        });

        const response = mapErrorToResponse({
          error,
          translator,
          traceId,
          metrics,
        });

        request.response = response;

        if (notifyUser) {
          const message = mapErrorToUserMessage(error, translator);

          await notifyUserSafely({
            notifyUser,
            message,
            request,
            traceId,
            logger,
            requestId,
            component,
          });
        }
      },
    };
  };

export const comprehensiveErrorHandler = errorHandlerMiddleware;
