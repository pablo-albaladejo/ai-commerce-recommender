// Portuguese translations
import type { TranslationMessages } from './en';

export const pt: TranslationMessages = {
  // Abuse protection errors
  'error.rateLimited':
    'Muitas solicitações. Por favor aguarde {{retryAfter}} segundos antes de tentar novamente.',
  'error.dailyQuotaExceeded':
    'Você atingiu seu limite diário de mensagens ({{limit}} mensagens). Tente novamente amanhã.',
  'error.tokenBudgetExceeded':
    'Você atingiu seu limite mensal de uso. Sua cota será reiniciada em {{resetTime}}.',

  // Security errors
  'error.unauthorized':
    'Solicitação não autorizada. Por favor tente novamente.',

  // Generic errors
  'error.validation':
    'Solicitação inválida. Por favor verifique sua mensagem e tente novamente.',
  'error.internal':
    'Ocorreu um erro inesperado. Por favor tente novamente mais tarde.',

  // Success messages
  'message.welcome':
    'Bem-vindo! Sou seu assistente de compras. Como posso ajudá-lo hoje?',
  'message.processing': 'Processando sua solicitação...',
};
