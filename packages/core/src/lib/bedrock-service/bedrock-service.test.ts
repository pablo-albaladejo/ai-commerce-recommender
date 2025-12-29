import { BedrockService, BedrockServiceConfig } from './bedrock-service';

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  InvokeModelCommand: jest.fn(),
}));

describe('BedrockService', () => {
  let service: BedrockService;
  let config: BedrockServiceConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();

    config = {
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      region: 'us-east-1',
      maxRetries: 3,
      timeoutMs: 30000,
    };

    service = new BedrockService(config);
  });

  describe('Constructor', () => {
    test('initializes with provided configuration', () => {
      const serviceConfig = service.getConfig();
      expect(serviceConfig).toEqual(config);
    });

    test('uses default values for optional configuration', () => {
      const minimalConfig = { modelId: 'test-model' };
      const serviceWithDefaults = new BedrockService(minimalConfig);
      const resultConfig = serviceWithDefaults.getConfig();

      expect(resultConfig.maxRetries).toBe(3);
      expect(resultConfig.timeoutMs).toBe(30000);
    });
  });

  describe('generateText', () => {
    test('generates text successfully with basic prompt', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            completion: 'This is a test response from Claude.',
            stop_reason: 'stop_sequence',
          })
        ),
        $metadata: {
          requestId: 'test-request-id',
        },
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateText('Hello, how are you?');

      expect(result).toEqual({
        text: 'This is a test response from Claude.',
        tokenUsage: {
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number),
          totalTokens: expect.any(Number),
        },
        finishReason: 'stop',
        modelId: config.modelId,
        requestId: 'test-request-id',
      });

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
    });

    test('handles different stop reasons correctly', async () => {
      const testCases = [
        { claudeReason: 'stop_sequence', expectedReason: 'stop' },
        { claudeReason: 'end_turn', expectedReason: 'stop' },
        { claudeReason: 'max_tokens', expectedReason: 'length' },
        { claudeReason: 'unknown_reason', expectedReason: 'error' },
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          body: new TextEncoder().encode(
            JSON.stringify({
              completion: 'Test response',
              stop_reason: testCase.claudeReason,
            })
          ),
          $metadata: {
            requestId: 'test-request-id',
          },
        };

        mockSend.mockResolvedValue(mockResponse);

        const result = await service.generateText('Test prompt');
        expect(result.finishReason).toBe(testCase.expectedReason);
      }
    });

    test('estimates token count correctly', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            completion: 'Short response',
            stop_reason: 'stop_sequence',
          })
        ),
        $metadata: {
          requestId: 'test-request-id',
        },
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateText('Test prompt');

      expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
      expect(result.tokenUsage.outputTokens).toBeGreaterThan(0);
      expect(result.tokenUsage.totalTokens).toBe(
        result.tokenUsage.inputTokens + result.tokenUsage.outputTokens
      );
    });

    test('throws error when no response body received', async () => {
      const mockResponse = {
        body: undefined,
        $metadata: {
          requestId: 'test-request-id',
        },
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(service.generateText('Test prompt')).rejects.toThrow(
        'No response body received from Bedrock'
      );
    });

    test('throws error when Bedrock client fails', async () => {
      const bedRockError = new Error('Bedrock service unavailable');
      mockSend.mockRejectedValue(bedRockError);

      await expect(service.generateText('Test prompt')).rejects.toThrow(
        'Bedrock service error: Bedrock service unavailable'
      );
    });

    test('trims whitespace from response text', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            completion: '  \n  Response with whitespace  \n  ',
            stop_reason: 'stop_sequence',
          })
        ),
        $metadata: {
          requestId: 'test-request-id',
        },
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.generateText('Test prompt');
      expect(result.text).toBe('Response with whitespace');
    });
  });

  describe('testConnection', () => {
    test('returns true when connection is successful', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            completion: 'Hello',
            stop_reason: 'stop_sequence',
          })
        ),
        $metadata: {
          requestId: 'test-request-id',
        },
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    test('returns false when connection fails', async () => {
      mockSend.mockRejectedValue(new Error('Connection failed'));

      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('getConfig', () => {
    test('returns a copy of the configuration', () => {
      const returnedConfig = service.getConfig();
      expect(returnedConfig).toEqual(config);
      expect(returnedConfig).not.toBe(config); // Should be a copy, not the same object
    });
  });
});
