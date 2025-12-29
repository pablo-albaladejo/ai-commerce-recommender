import {
  DEFAULT_LOCALE,
  normalizeLocale,
  SUPPORTED_LOCALES,
} from '../../application/services/translation-service';
import {
  createTranslationService,
  defaultTranslationService,
} from './translation-service';

describe('TranslationService', () => {
  describe('createTranslationService', () => {
    it('should create a service with the specified locale', () => {
      const service = createTranslationService('es');
      expect(service.getLocale()).toBe('es');
    });

    it('should translate keys to the correct language', () => {
      const enService = createTranslationService('en');
      const esService = createTranslationService('es');

      const enMessage = enService.t('error.rateLimited', { retryAfter: 30 });
      const esMessage = esService.t('error.rateLimited', { retryAfter: 30 });

      expect(enMessage).toContain('30');
      expect(enMessage).toContain('seconds');
      expect(esMessage).toContain('30');
      expect(esMessage).toContain('segundos');
    });

    it('should interpolate parameters correctly', () => {
      const service = createTranslationService('en');
      const message = service.t('error.dailyQuotaExceeded', { limit: 100 });

      expect(message).toContain('100');
      expect(message).toContain('daily message limit');
    });

    it('should fall back to default locale for missing translations', () => {
      // Create a service with an unsupported locale (falls back to default)
      const service = createTranslationService('en');
      const message = service.t('error.internal');

      expect(message).toBeTruthy();
      expect(message).not.toBe('error.internal');
    });
  });

  describe('defaultTranslationService', () => {
    it('should use the default locale', () => {
      expect(defaultTranslationService.getLocale()).toBe(DEFAULT_LOCALE);
    });

    it('should translate keys correctly', () => {
      const message = defaultTranslationService.t('error.unauthorized');
      expect(message).toBeTruthy();
      expect(message).not.toBe('error.unauthorized');
    });
  });

  describe('normalizeLocale', () => {
    it('should return default locale for undefined input', () => {
      expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    });

    it('should return default locale for empty string', () => {
      expect(normalizeLocale('')).toBe(DEFAULT_LOCALE);
    });

    it('should extract primary language tag', () => {
      expect(normalizeLocale('en-US')).toBe('en');
      expect(normalizeLocale('es-AR')).toBe('es');
      expect(normalizeLocale('pt-BR')).toBe('pt');
    });

    it('should handle simple language codes', () => {
      expect(normalizeLocale('en')).toBe('en');
      expect(normalizeLocale('es')).toBe('es');
      expect(normalizeLocale('fr')).toBe('fr');
    });

    it('should return default locale for unsupported languages', () => {
      expect(normalizeLocale('zh')).toBe(DEFAULT_LOCALE);
      expect(normalizeLocale('ja')).toBe(DEFAULT_LOCALE);
      expect(normalizeLocale('ko')).toBe(DEFAULT_LOCALE);
    });

    it('should be case insensitive', () => {
      expect(normalizeLocale('EN')).toBe('en');
      expect(normalizeLocale('Es')).toBe('es');
      expect(normalizeLocale('PT-br')).toBe('pt');
    });
  });

  describe('SUPPORTED_LOCALES', () => {
    it('should include all expected locales', () => {
      expect(SUPPORTED_LOCALES).toContain('en');
      expect(SUPPORTED_LOCALES).toContain('es');
      expect(SUPPORTED_LOCALES).toContain('pt');
      expect(SUPPORTED_LOCALES).toContain('fr');
      expect(SUPPORTED_LOCALES).toContain('de');
      expect(SUPPORTED_LOCALES).toContain('it');
    });
  });

  describe('All translations', () => {
    const locales = ['en', 'es', 'pt', 'fr', 'de', 'it'] as const;
    const keys = [
      'error.rateLimited',
      'error.dailyQuotaExceeded',
      'error.tokenBudgetExceeded',
      'error.unauthorized',
      'error.validation',
      'error.internal',
      'message.welcome',
      'message.processing',
    ] as const;

    locales.forEach(locale => {
      describe(`${locale} locale`, () => {
        const service = createTranslationService(locale);

        keys.forEach(key => {
          it(`should have translation for ${key}`, () => {
            const translation = service.t(key);
            expect(translation).toBeTruthy();
            expect(translation).not.toBe(key);
          });
        });
      });
    });
  });
});
