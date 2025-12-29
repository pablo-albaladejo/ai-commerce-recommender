/**
 * Validate signature against secret token
 */
export type ValidateSignature = (
  providedSignature: string,
  secretToken: string
) => boolean;

/**
 * Get secret token for validation
 */
export type GetSecretToken = () => string | undefined;
