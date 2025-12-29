// English translations (default locale)

/**
 * Type for translation messages.
 * Keys are the translation keys, values are the translated strings.
 */
export type TranslationMessages = {
  'error.rateLimited': string;
  'error.dailyQuotaExceeded': string;
  'error.tokenBudgetExceeded': string;
  'error.unauthorized': string;
  'error.validation': string;
  'error.internal': string;
  'message.welcome': string;
  'message.processing': string;
};

export const en: TranslationMessages = {
  // Abuse protection errors
  'error.rateLimited':
    'Too many requests. Please wait {{retryAfter}} seconds before trying again.',
  'error.dailyQuotaExceeded':
    'You have reached your daily message limit ({{limit}} messages). Try again tomorrow.',
  'error.tokenBudgetExceeded':
    'You have reached your monthly usage limit. Your quota will reset on {{resetTime}}.',

  // Security errors
  'error.unauthorized': 'Unauthorized request. Please try again.',

  // Generic errors
  'error.validation':
    'Invalid request. Please check your message and try again.',
  'error.internal': 'An unexpected error occurred. Please try again later.',

  // Success messages
  'message.welcome':
    'Welcome! I am your shopping assistant. How can I help you today?',
  'message.processing': 'Processing your request...',
};
