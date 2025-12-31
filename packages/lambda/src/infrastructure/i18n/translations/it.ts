// Italian translations
import type { TranslationMessages } from './en';

export const it: TranslationMessages = {
  // Abuse protection errors
  'error.rateLimited':
    'Troppe richieste. Attendi {{retryAfter}} secondi prima di riprovare.',
  'error.dailyQuotaExceeded':
    'Hai raggiunto il limite giornaliero di messaggi ({{limit}} messaggi). Riprova domani.',
  'error.tokenBudgetExceeded':
    'Hai raggiunto il limite mensile di utilizzo. La tua quota verrà ripristinata il {{resetTime}}.',

  // Security errors
  'error.unauthorized': 'Richiesta non autorizzata. Riprova.',

  // Generic errors
  'error.validation':
    'Richiesta non valida. Controlla il tuo messaggio e riprova.',
  'error.internal': 'Si è verificato un errore imprevisto. Riprova più tardi.',

  // Success messages
  'message.welcome':
    'Benvenuto! Sono il tuo assistente per gli acquisti. Come posso aiutarti oggi?',
  'message.processing': 'Elaborazione della tua richiesta...',
  'message.outOfScopeCommerce':
    'Mi dispiace, posso rispondere solo a domande su questo negozio.',
};
