import type {
  ConversationContext,
  ConversationMessage,
} from '../../domain/conversation';
import { ConversationContextBuilder } from '../../tests/fixtures/conversation-context.builder';
import { MiddyRequestBuilder } from '../../tests/fixtures/middy-request.builder';
import {
  addConversationMessages,
  contextManagerMiddleware,
  createMessage,
  getConversationContext,
} from './context-manager';

/**
 * Type extension for Lambda context with conversation properties.
 * Matches the internal ContextExtension type in context-manager.ts
 */
type TestContextExtension = {
  conversationContext?: ConversationContext | null;
  newConversationMessages?: ConversationMessage[];
};

describe('Context Manager Middleware', () => {
  // Mock dependencies
  const mockGetContext = jest.fn();
  const mockAddMessage = jest.fn();
  const mockExtractUserId = jest.fn();
  const mockExtractChatId = jest.fn();

  const createMiddleware = (config = {}) =>
    contextManagerMiddleware({
      getContext: mockGetContext,
      addMessage: mockAddMessage,
      extractUserId: mockExtractUserId,
      extractChatId: mockExtractChatId,
    })(config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('before hook', () => {
    test('loads conversation context when user and chat IDs are available', async () => {
      const mockContext = ConversationContextBuilder.build();
      mockExtractUserId.mockReturnValue(123);
      mockExtractChatId.mockReturnValue(456);
      mockGetContext.mockResolvedValue(mockContext);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build();

      await middleware.before!(mockRequest);

      expect(mockGetContext).toHaveBeenCalledWith(123, 456);
      expect(
        (mockRequest.context as unknown as TestContextExtension)
          .conversationContext
      ).toEqual(mockContext);
    });

    test('skips loading context when user ID is not available', async () => {
      mockExtractUserId.mockReturnValue(undefined);
      mockExtractChatId.mockReturnValue(456);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build();

      await middleware.before!(mockRequest);

      expect(mockGetContext).not.toHaveBeenCalled();
    });

    test('skips loading context when chat ID is not available', async () => {
      mockExtractUserId.mockReturnValue(123);
      mockExtractChatId.mockReturnValue(undefined);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build();

      await middleware.before!(mockRequest);

      expect(mockGetContext).not.toHaveBeenCalled();
    });

    test('handles null context from service', async () => {
      mockExtractUserId.mockReturnValue(123);
      mockExtractChatId.mockReturnValue(456);
      mockGetContext.mockResolvedValue(null);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build();

      await middleware.before!(mockRequest);

      expect(
        (mockRequest.context as unknown as TestContextExtension)
          .conversationContext
      ).toBeNull();
    });
  });

  describe('after hook', () => {
    test('saves new messages after request completes', async () => {
      mockExtractUserId.mockReturnValue(123);
      mockExtractChatId.mockReturnValue(456);
      mockGetContext.mockResolvedValue(ConversationContextBuilder.build());
      mockAddMessage.mockResolvedValue(undefined);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build();

      // Run before hook to set up context
      await middleware.before!(mockRequest);

      // Add messages using the helper
      const testMessages: ConversationMessage[] = [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        {
          role: 'agent',
          content: 'Hi there',
          timestamp: new Date().toISOString(),
        },
      ];
      addConversationMessages(mockRequest.context, testMessages);

      // Run after hook
      await middleware.after!(mockRequest);

      expect(mockAddMessage).toHaveBeenCalledTimes(2);
      expect(mockAddMessage).toHaveBeenCalledWith(123, 456, testMessages[0]);
      expect(mockAddMessage).toHaveBeenCalledWith(123, 456, testMessages[1]);
    });

    test('skips saving when no new messages', async () => {
      mockExtractUserId.mockReturnValue(123);
      mockExtractChatId.mockReturnValue(456);
      mockGetContext.mockResolvedValue(ConversationContextBuilder.build());

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build();

      await middleware.before!(mockRequest);
      await middleware.after!(mockRequest);

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    test('skips saving when context was not loaded', async () => {
      mockExtractUserId.mockReturnValue(undefined);
      mockExtractChatId.mockReturnValue(456);

      const middleware = createMiddleware();
      const mockRequest = MiddyRequestBuilder.build();

      // Manually set new messages (simulating someone adding messages without context)
      (
        mockRequest.context as unknown as TestContextExtension
      ).newConversationMessages = [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      ];

      await middleware.before!(mockRequest);
      await middleware.after!(mockRequest);

      expect(mockAddMessage).not.toHaveBeenCalled();
    });
  });

  describe('helper functions', () => {
    describe('getConversationContext', () => {
      test('returns context when available', () => {
        const mockContext = ConversationContextBuilder.build();
        const context: TestContextExtension = {
          conversationContext: mockContext,
        };

        expect(getConversationContext(context)).toEqual(mockContext);
      });

      test('returns null when context is null', () => {
        const context: TestContextExtension = {
          conversationContext: null,
        };

        expect(getConversationContext(context)).toBeNull();
      });

      test('returns null when context property is missing', () => {
        const context = {};

        expect(getConversationContext(context)).toBeNull();
      });
    });

    describe('addConversationMessages', () => {
      test('adds messages to empty array', () => {
        const context: TestContextExtension = {};
        const messages: ConversationMessage[] = [
          {
            role: 'user',
            content: 'Hello',
            timestamp: new Date().toISOString(),
          },
        ];

        addConversationMessages(context, messages);

        expect(context.newConversationMessages).toEqual(messages);
      });

      test('appends messages to existing array', () => {
        const existingMessage: ConversationMessage = {
          role: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString(),
        };
        const context: TestContextExtension = {
          newConversationMessages: [existingMessage],
        };
        const newMessages: ConversationMessage[] = [
          {
            role: 'agent',
            content: 'Hi',
            timestamp: new Date().toISOString(),
          },
        ];

        addConversationMessages(context, newMessages);

        expect(context.newConversationMessages).toHaveLength(2);
        expect(context.newConversationMessages).toContainEqual(existingMessage);
        expect(context.newConversationMessages).toContainEqual(newMessages[0]);
      });
    });

    describe('createMessage', () => {
      test('creates user message with token count', () => {
        const message = createMessage('user', 'Hello world');

        expect(message.role).toBe('user');
        expect(message.content).toBe('Hello world');
        expect(message.timestamp).toBeDefined();
        expect(message.tokenCount).toBe(3); // "Hello world" = 11 chars / 4 = 2.75 -> 3
      });

      test('creates agent message with token count', () => {
        const message = createMessage('agent', 'Hi there!');

        expect(message.role).toBe('agent');
        expect(message.content).toBe('Hi there!');
        expect(message.timestamp).toBeDefined();
        expect(message.tokenCount).toBe(3); // "Hi there!" = 9 chars / 4 = 2.25 -> 3
      });

      test('estimates tokens correctly for longer text', () => {
        const longText = 'This is a longer message with more characters';
        const message = createMessage('user', longText);

        // 46 chars / 4 = 11.5 -> 12
        expect(message.tokenCount).toBe(12);
      });
    });
  });
});
