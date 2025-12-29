// ============================================================================
// Translation Service - Infrastructure Implementation
// ============================================================================

import {
  DEFAULT_LOCALE,
  type Locale,
  type TranslationKey,
  type TranslationParams,
  type TranslationService,
} from '../../application/services/translation-service';
import { de } from './translations/de';
import { en, type TranslationMessages } from './translations/en';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { it } from './translations/it';
import { pt } from './translations/pt';

// ============================================================================
// Translation Registry
// ============================================================================

const translations: Record<Locale, TranslationMessages> = {
  en,
  es,
  pt,
  fr,
  de,
  it,
};

// ============================================================================
// Interpolation Helper
// ============================================================================

/**
 * Interpolates parameters into a translation string.
 * Replaces {{param}} with the corresponding value from params.
 *
 * @param template - Translation string with {{param}} placeholders
 * @param params - Key-value pairs to interpolate
 * @returns Interpolated string
 */
const interpolate = (template: string, params?: TranslationParams): string => {
  if (!params) return template;

  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`{{${key}}}`, 'g'), String(value)),
    template
  );
};

// ============================================================================
// Translation Service Factory
// ============================================================================

/**
 * Creates a TranslationService instance for a specific locale.
 * This is the factory function used to create translation services.
 *
 * @param locale - The locale to use for translations
 * @returns TranslationService instance
 */
export const createTranslationService = (
  locale: Locale
): TranslationService => {
  const messages = translations[locale] || translations[DEFAULT_LOCALE];

  return {
    t(key: TranslationKey, params?: TranslationParams): string {
      const template = messages[key] || translations[DEFAULT_LOCALE][key];

      if (!template) {
        // Fallback for missing translations (should not happen with proper typing)
        return key;
      }

      return interpolate(template, params);
    },

    getLocale(): Locale {
      return locale;
    },
  };
};

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default translation service using the default locale.
 * Useful for cases where no locale is specified.
 */
export const defaultTranslationService =
  createTranslationService(DEFAULT_LOCALE);
