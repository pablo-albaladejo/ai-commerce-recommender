import { SignatureValidationError } from '../../domain/errors';
import { MiddyRequestBuilder } from '../../tests/fixtures/middy-request.builder';
import { signatureValidationMiddleware } from './signature-validation';

describe('Signature Validation Middleware', () => {
  const TEST_SECRET_TOKEN = 'test-secret-token-123';
  const INVALID_TOKEN = 'invalid-token';

  // Mock dependencies
  let mockGetSecretToken: jest.Mock;
  let mockValidateSignature: jest.Mock;

  beforeEach(() => {
    mockGetSecretToken = jest.fn();
    mockValidateSignature = jest.fn();
  });

  const createMiddleware = (config = {}) =>
    signatureValidationMiddleware({
      getSecretToken: mockGetSecretToken,
      validateSignature: mockValidateSignature,
    })(config);

  describe('before hook', () => {
    test('validates signature successfully', async () => {
      mockGetSecretToken.mockReturnValue(TEST_SECRET_TOKEN);
      mockValidateSignature.mockReturnValue(true);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build({
        event: {
          ...MiddyRequestBuilder.build().event,
          headers: {
            'x-telegram-bot-api-secret-token': TEST_SECRET_TOKEN,
          },
        },
      });

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();
      expect(mockValidateSignature).toHaveBeenCalledWith(
        TEST_SECRET_TOKEN,
        TEST_SECRET_TOKEN
      );
    });

    test('throws error when signature is invalid', async () => {
      mockGetSecretToken.mockReturnValue(TEST_SECRET_TOKEN);
      mockValidateSignature.mockReturnValue(false);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build({
        event: {
          ...MiddyRequestBuilder.build().event,
          headers: {
            'x-telegram-bot-api-secret-token': INVALID_TOKEN,
          },
        },
      });

      await expect(middleware.before!(mockRequest)).rejects.toThrow(
        SignatureValidationError
      );
    });

    test('throws error when signature header is missing and required', async () => {
      mockGetSecretToken.mockReturnValue(TEST_SECRET_TOKEN);

      const middleware = createMiddleware({ required: true });
      const mockRequest = MiddyRequestBuilder.build({
        event: {
          ...MiddyRequestBuilder.build().event,
          headers: {},
        },
      });

      await expect(middleware.before!(mockRequest)).rejects.toThrow(
        SignatureValidationError
      );
    });

    test('skips validation when signature header is missing and not required', async () => {
      mockGetSecretToken.mockReturnValue(TEST_SECRET_TOKEN);

      const middleware = createMiddleware({ required: false });
      const mockRequest = MiddyRequestBuilder.build({
        event: {
          ...MiddyRequestBuilder.build().event,
          headers: {},
        },
      });

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();
      expect(mockValidateSignature).not.toHaveBeenCalled();
    });

    test('throws error when secret token is not configured', async () => {
      mockGetSecretToken.mockReturnValue(undefined);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build({
        event: {
          ...MiddyRequestBuilder.build().event,
          headers: {
            'x-telegram-bot-api-secret-token': TEST_SECRET_TOKEN,
          },
        },
      });

      await expect(middleware.before!(mockRequest)).rejects.toThrow(
        SignatureValidationError
      );
    });

    test('uses custom header name when configured', async () => {
      mockGetSecretToken.mockReturnValue(TEST_SECRET_TOKEN);
      mockValidateSignature.mockReturnValue(true);

      const middleware = createMiddleware({ headerName: 'X-Custom-Token' });
      const mockRequest = MiddyRequestBuilder.build({
        event: {
          ...MiddyRequestBuilder.build().event,
          headers: {
            'X-Custom-Token': TEST_SECRET_TOKEN,
          },
        },
      });

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();
      expect(mockValidateSignature).toHaveBeenCalledWith(
        TEST_SECRET_TOKEN,
        TEST_SECRET_TOKEN
      );
    });

    test('handles case-insensitive header matching', async () => {
      mockGetSecretToken.mockReturnValue(TEST_SECRET_TOKEN);
      mockValidateSignature.mockReturnValue(true);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build({
        event: {
          ...MiddyRequestBuilder.build().event,
          headers: {
            'X-Telegram-Bot-Api-Secret-Token': TEST_SECRET_TOKEN, // Different case
          },
        },
      });

      await expect(middleware.before!(mockRequest)).resolves.toBeUndefined();
      expect(mockValidateSignature).toHaveBeenCalled();
    });
  });

  describe('SignatureValidationError', () => {
    test('has correct name and message', () => {
      const error = new SignatureValidationError('Test error message');

      expect(error.name).toBe('SignatureValidationError');
      expect(error.message).toBe('Test error message');
    });

    test('is instance of Error', () => {
      const error = new SignatureValidationError('Test error');

      expect(error).toBeInstanceOf(Error);
    });
  });
});
