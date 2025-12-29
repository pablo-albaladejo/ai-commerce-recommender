import type middy from '@middy/core';
import type { Context } from 'aws-lambda';
import type { ExtendedLambdaContext } from '../types/lambda-context';
import { i18nMiddleware } from './i18n-middleware';

describe('i18nMiddleware', () => {
  const createMockRequest = (event: unknown): middy.Request => ({
    event,
    context: {} as Context,
    response: undefined,
    error: null,
    internal: {},
  });

  describe('i18nMiddleware factory', () => {
    it('should create middleware that sets translation service in context', async () => {
      const extractLocale = jest.fn().mockReturnValue('es');
      const middleware = i18nMiddleware({ extractLocale })();
      const request = createMockRequest({ test: true });

      await middleware.before?.(request);

      const ctx = request.context as unknown as ExtendedLambdaContext;
      expect(ctx.translationService).toBeDefined();
      expect(ctx.locale).toBe('es');
      expect(ctx.translationService?.getLocale()).toBe('es');
    });

    it('should use default locale when extractLocale returns undefined', async () => {
      const extractLocale = jest.fn().mockReturnValue(undefined);
      const middleware = i18nMiddleware({ extractLocale })();
      const request = createMockRequest({ test: true });

      await middleware.before?.(request);

      const ctx = request.context as unknown as ExtendedLambdaContext;
      expect(ctx.locale).toBe('en');
    });

    it('should use custom default locale from config', async () => {
      const extractLocale = jest.fn().mockReturnValue(undefined);
      const middleware = i18nMiddleware({ extractLocale })({
        defaultLocale: 'es',
      });
      const request = createMockRequest({ test: true });

      await middleware.before?.(request);

      const ctx = request.context as unknown as ExtendedLambdaContext;
      expect(ctx.locale).toBe('es');
    });

    it('should call extractLocale with the event', async () => {
      const extractLocale = jest.fn().mockReturnValue('fr');
      const middleware = i18nMiddleware({ extractLocale })();
      const event = { message: { from: { language_code: 'fr' } } };
      const request = createMockRequest(event);

      await middleware.before?.(request);

      expect(extractLocale).toHaveBeenCalledWith(event);
    });

    it('should normalize locale codes to supported locales', async () => {
      const extractLocale = jest.fn().mockReturnValue('es-AR');
      const middleware = i18nMiddleware({ extractLocale })();
      const request = createMockRequest({});

      await middleware.before?.(request);

      const ctx = request.context as unknown as ExtendedLambdaContext;
      expect(ctx.locale).toBe('es');
    });

    it('should fall back to default for unsupported locales', async () => {
      const extractLocale = jest.fn().mockReturnValue('zh');
      const middleware = i18nMiddleware({ extractLocale })();
      const request = createMockRequest({});

      await middleware.before?.(request);

      const ctx = request.context as unknown as ExtendedLambdaContext;
      expect(ctx.locale).toBe('en');
    });
  });
});
