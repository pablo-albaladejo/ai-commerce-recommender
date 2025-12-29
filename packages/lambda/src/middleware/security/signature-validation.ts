import middy from '@middy/core';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type {
  GetSecretToken,
  ValidateSignature,
} from '../../application/services/signature-service';
import { SignatureValidationError } from '../../domain/errors';

// Re-export error for convenience
export { SignatureValidationError };

// ============================================================================
// Types
// ============================================================================

type SignatureValidationConfig = {
  headerName?: string;
  required?: boolean;
};

type SignatureValidationDependencies = {
  getSecretToken: GetSecretToken;
  validateSignature: ValidateSignature;
};

// ============================================================================
// Middleware
// ============================================================================

// ============================================================================
// Validation Helpers
// ============================================================================

const extractSignature = (
  headers: Record<string, string | undefined>,
  headerName: string
): string | null => {
  const key = Object.keys(headers).find(
    k => k.toLowerCase() === headerName.toLowerCase()
  );
  return key ? (headers[key] ?? null) : null;
};

const validateSecretToken = (secretToken: string | undefined): void => {
  if (!secretToken) {
    throw new SignatureValidationError(
      'Webhook signature validation not configured'
    );
  }
};

const validateSignaturePresence = (
  signature: string | null,
  required: boolean
): void => {
  if (required && !signature) {
    throw new SignatureValidationError('Missing required signature header');
  }
};

const validateSignatureValue = (
  signature: string,
  secretToken: string,
  validator: ValidateSignature
): void => {
  if (!validator(signature, secretToken)) {
    throw new SignatureValidationError('Invalid webhook signature');
  }
};

/**
 * Telegram webhook signature validation middleware
 */
export const signatureValidationMiddleware =
  (deps: SignatureValidationDependencies) =>
  (config: SignatureValidationConfig = {}): middy.MiddlewareObj => {
    const { headerName = 'x-telegram-bot-api-secret-token', required = true } =
      config;

    return {
      before: async request => {
        const secretToken = deps.getSecretToken();

        // Skip validation entirely if not required and no secret token configured
        if (!required && !secretToken) {
          return;
        }

        validateSecretToken(secretToken);

        const event = request.event as APIGatewayProxyEvent;
        const signature = extractSignature(event.headers || {}, headerName);

        validateSignaturePresence(signature, required);

        if (signature && secretToken) {
          validateSignatureValue(
            signature,
            secretToken,
            deps.validateSignature
          );
        }
      },
    };
  };

/** Convenience alias for Telegram webhooks */
export const telegramSignatureValidation = signatureValidationMiddleware;
