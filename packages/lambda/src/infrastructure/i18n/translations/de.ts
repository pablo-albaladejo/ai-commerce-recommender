// German translations
import type { TranslationMessages } from './en';

export const de: TranslationMessages = {
  // Abuse protection errors
  'error.rateLimited':
    'Zu viele Anfragen. Bitte warten Sie {{retryAfter}} Sekunden, bevor Sie es erneut versuchen.',
  'error.dailyQuotaExceeded':
    'Sie haben Ihr tägliches Nachrichtenlimit erreicht ({{limit}} Nachrichten). Versuchen Sie es morgen erneut.',
  'error.tokenBudgetExceeded':
    'Sie haben Ihr monatliches Nutzungslimit erreicht. Ihr Kontingent wird am {{resetTime}} zurückgesetzt.',

  // Security errors
  'error.unauthorized':
    'Nicht autorisierte Anfrage. Bitte versuchen Sie es erneut.',

  // Generic errors
  'error.validation':
    'Ungültige Anfrage. Bitte überprüfen Sie Ihre Nachricht und versuchen Sie es erneut.',
  'error.internal':
    'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',

  // Success messages
  'message.welcome':
    'Willkommen! Ich bin Ihr Einkaufsassistent. Wie kann ich Ihnen heute helfen?',
  'message.processing': 'Ihre Anfrage wird bearbeitet...',
  'message.outOfScopeCommerce':
    'Entschuldigung, ich kann nur Fragen zu diesem Shop beantworten.',
};
