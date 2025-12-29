// French translations
import type { TranslationMessages } from './en';

export const fr: TranslationMessages = {
  // Abuse protection errors
  'error.rateLimited':
    'Trop de requêtes. Veuillez attendre {{retryAfter}} secondes avant de réessayer.',
  'error.dailyQuotaExceeded':
    'Vous avez atteint votre limite quotidienne de messages ({{limit}} messages). Réessayez demain.',
  'error.tokenBudgetExceeded':
    "Vous avez atteint votre limite d'utilisation mensuelle. Votre quota sera réinitialisé le {{resetTime}}.",

  // Security errors
  'error.unauthorized': 'Requête non autorisée. Veuillez réessayer.',

  // Generic errors
  'error.validation':
    'Requête invalide. Veuillez vérifier votre message et réessayer.',
  'error.internal':
    "Une erreur inattendue s'est produite. Veuillez réessayer plus tard.",

  // Success messages
  'message.welcome':
    "Bienvenue ! Je suis votre assistant d'achat. Comment puis-je vous aider aujourd'hui ?",
  'message.processing': 'Traitement de votre demande...',
};
