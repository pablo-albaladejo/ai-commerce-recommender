// ============================================================================
// i18n Middleware - Sets up translation service in Lambda context
// ============================================================================

import middy from '@middy/core';
import {
  DEFAULT_LOCALE,
  type Locale,
  normalizeLocale,
} from '../../application/services/translation-service';
import { createTranslationService } from '../../infrastructure/i18n/translation-service';
import type { ExtendedLambdaContext } from '../types/lambda-context';

// ============================================================================
// Types
// ============================================================================

/**
 * Dependencies for the i18n middleware.
 */
export type I18nMiddlewareDeps = {
  /** Function to extract locale from the event */
  extractLocale: (event: unknown) => string | undefined;
};

/**
 * Configuration options for the i18n middleware.
 */
export type I18nMiddlewareConfig = {
  /** Default locale to use if none is extracted */
  defaultLocale?: Locale;
};

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Creates an i18n middleware that sets up translation service in Lambda context.
 *
 * @param deps - Dependencies including locale extraction function
 * @returns Middleware factory function
 *
 * @example
 * ```typescript
 * const i18n = i18nMiddleware({
 *   extractLocale: (event) => event.message?.from?.language_code,
 * });
 *
 * const handler = middy(baseHandler)
 *   .use(i18n({ defaultLocale: 'es' }));
 * ```
 */
export const i18nMiddleware =
  (deps: I18nMiddlewareDeps) =>
  (config: I18nMiddlewareConfig = {}): middy.MiddlewareObj => {
    const { extractLocale } = deps;
    const { defaultLocale = DEFAULT_LOCALE } = config;

    return {
      before: async (request): Promise<void> => {
        // Extract language code from event
        const languageCode = extractLocale(request.event);

        // Normalize to supported locale, using custom defaultLocale as fallback
        const normalizedLocale = languageCode
          ? normalizeLocale(languageCode)
          : null;
        const locale = normalizedLocale || defaultLocale;

        // Create translation service for this locale
        const translationService = createTranslationService(locale);

        // Extend Lambda context with i18n
        const extendedContext =
          request.context as unknown as ExtendedLambdaContext;
        extendedContext.translationService = translationService;
        extendedContext.locale = locale;
      },
    };
  };
