import type { Logger } from '@aws-lambda-powertools/logger';
import type middy from '@middy/core';
import { createTranslationService } from '../../infrastructure/i18n/translation-service';
import { LambdaContextBuilder } from '../../tests/fixtures/api-event.builder';
import type { ExtendedLambdaContext } from '../types/lambda-context';
import { errorHandlerMiddleware } from './error-handler';

describe('errorHandlerMiddleware', () => {
  it('for AI SDK errors, notifies the user (if configured) and returns 200 to avoid Telegram retries', async () => {
    const notifyUser = jest.fn().mockResolvedValue(undefined);
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
    };

    const middleware = errorHandlerMiddleware({
      logger: logger as unknown as Logger,
      notifyUser,
    })({ component: 'telegram-webhook' });

    const ctx =
      LambdaContextBuilder.build() as unknown as ExtendedLambdaContext;
    ctx.trace = {
      traceId: 'trace-1',
      requestId: 'req-1',
      timestamp: new Date().toISOString(),
      spanId: 'span-1',
    };
    ctx.translationService = createTranslationService('en');

    const error = new Error('Bedrock denied');
    error.name = 'AI_APICallError';

    const request = {
      event: { any: 'event' },
      context: ctx,
      response: null,
      error,
      internal: {},
    } as unknown as middy.Request;

    await middleware.onError?.(request);

    expect(notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'An unexpected error occurred. Please try again later.',
        traceId: 'trace-1',
      })
    );

    expect(request.response?.statusCode).toBe(200);
    const body = JSON.parse(request.response.body);
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'LLM_ERROR' }),
        trace_id: 'trace-1',
      })
    );
  });

  it('for non-AI errors, returns 500 and notifies the user (if configured)', async () => {
    const notifyUser = jest.fn().mockResolvedValue(undefined);
    const logger = { error: jest.fn(), warn: jest.fn() };

    const middleware = errorHandlerMiddleware({
      logger: logger as unknown as Logger,
      notifyUser,
    })();

    const ctx =
      LambdaContextBuilder.build() as unknown as ExtendedLambdaContext;
    ctx.trace = {
      traceId: 'trace-1',
      requestId: 'req-1',
      timestamp: new Date().toISOString(),
      spanId: 'span-1',
    };
    ctx.translationService = createTranslationService('en');

    const request = {
      event: {},
      context: ctx,
      response: null,
      error: new Error('Bug'),
      internal: {},
    } as unknown as middy.Request;

    await middleware.onError?.(request);

    expect(notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'An unexpected error occurred. Please try again later.',
        traceId: 'trace-1',
      })
    );
    expect(request.response?.statusCode).toBe(500);
  });
});
