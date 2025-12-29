// ============================================================================
// Translation Service - Application Port
// ============================================================================

/**
 * Supported locales for the application.
 * Based on IETF BCP 47 language tags from Telegram.
 */
export type Locale = 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it';

export const DEFAULT_LOCALE: Locale = 'en';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'pt', 'fr', 'de', 'it'];

/**
 * Translation keys for user-facing messages.
 * Organized by domain/feature for clarity.
 */
export type TranslationKey =
  // Abuse protection errors
  | 'error.rateLimited'
  | 'error.dailyQuotaExceeded'
  | 'error.tokenBudgetExceeded'
  // Security errors
  | 'error.unauthorized'
  // Generic errors
  | 'error.validation'
  | 'error.internal'
  // Success messages
  | 'message.welcome'
  | 'message.processing';

/**
 * Parameters that can be interpolated into translation strings.
 */
export type TranslationParams = Record<string, string | number>;

/**
 * Translation Service Interface (Port)
 *
 * Defines the contract for translation services.
 * Implementation lives in infrastructure layer.
 */
export type TranslationService = {
  /**
   * Translate a key to the current locale.
   * Falls back to default locale if translation is missing.
   *
   * @param key - The translation key
   * @param params - Optional interpolation parameters
   * @returns Translated string
   */
  t(key: TranslationKey, params?: TranslationParams): string;

  /**
   * Get the current locale.
   */
  getLocale(): Locale;
};

/**
 * Normalizes a language code from Telegram to a supported locale.
 * Handles cases like 'en-US' -> 'en', 'es-AR' -> 'es'.
 *
 * @param languageCode - Language code from Telegram (optional)
 * @returns Normalized supported locale
 */
export const normalizeLocale = (languageCode?: string): Locale => {
  if (!languageCode) return DEFAULT_LOCALE;

  // Extract primary language subtag (e.g., 'en' from 'en-US')
  const primaryTag = languageCode.split('-')[0].toLowerCase();

  // Check if it's a supported locale
  if (SUPPORTED_LOCALES.includes(primaryTag as Locale)) {
    return primaryTag as Locale;
  }

  return DEFAULT_LOCALE;
};
