import { timingSafeEqual } from 'crypto';
import type {
  GetSecretToken,
  ValidateSignature,
} from '../../application/services/signature-service';

/**
 * Default timing-safe signature validation
 */
export const validateSignature: ValidateSignature = (
  providedSignature,
  secretToken
) => {
  if (providedSignature.length !== secretToken.length) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(secretToken)
  );
};

/**
 * Default secret token getter from environment
 */
export const getSecretToken: GetSecretToken = () =>
  process.env.TELEGRAM_SECRET_TOKEN;
