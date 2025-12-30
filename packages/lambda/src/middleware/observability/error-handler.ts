import type { Logger } from '@aws-lambda-powertools/logger';
import type { Metrics } from '@aws-lambda-powertools/metrics';
import middy from '@middy/core';
import { defaultTranslationService } from '../../infrastructure/i18n/translation-service';
import type { ExtendedLambdaContext } from '../types/lambda-context';
import { calculateDurationMs, mapErrorToResponse } from './error-handler.logic';

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
          error: { name: error?.name, message: error?.message },
        });

        const response = mapErrorToResponse({
          error,
          translator,
          traceId,
          metrics,
        });

        request.response = response;

        if (notifyUser) {
          const message = translator.t('error.internal');

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
