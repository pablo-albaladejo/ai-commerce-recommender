// Spanish translations
import type { TranslationMessages } from './en';

export const es: TranslationMessages = {
  // Abuse protection errors
  'error.rateLimited':
    'Demasiadas solicitudes. Por favor espera {{retryAfter}} segundos antes de intentar de nuevo.',
  'error.dailyQuotaExceeded':
    'Has alcanzado tu límite diario de mensajes ({{limit}} mensajes). Intenta de nuevo mañana.',
  'error.tokenBudgetExceeded':
    'Has alcanzado tu límite mensual de uso. Tu cuota se reiniciará el {{resetTime}}.',

  // Security errors
  'error.unauthorized': 'Solicitud no autorizada. Por favor intenta de nuevo.',

  // Generic errors
  'error.validation':
    'Solicitud inválida. Por favor verifica tu mensaje e intenta de nuevo.',
  'error.internal':
    'Ha ocurrido un error inesperado. Por favor intenta de nuevo más tarde.',

  // Success messages
  'message.welcome':
    '¡Bienvenido! Soy tu asistente de compras. ¿En qué puedo ayudarte hoy?',
  'message.processing': 'Procesando tu solicitud...',
  'message.outOfScopeCommerce':
    'Lo siento, solo puedo responder preguntas sobre esta tienda.',
};
