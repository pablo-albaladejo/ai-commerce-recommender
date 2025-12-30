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

const buildErrorLogDetails = (error: Error): ErrorLogDetails => {
  const details: ErrorLogDetails = {
    name: error.name,
    message: error.message,
    stack: error.stack,
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
    details.cause = { name: cause.name, message: cause.message };
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
