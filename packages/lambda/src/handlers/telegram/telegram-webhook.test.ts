import {
  TelegramChatBuilder,
  TelegramMessageBuilder,
  TelegramUpdateBuilder,
  TelegramUserBuilder,
} from '../../tests/fixtures/telegram-message.builder';

// Mock Telegram client singleton
const mockSendMessage = jest.fn().mockResolvedValue(true);
jest.mock('../../infrastructure/shared/telegram-client', () => ({
  getTelegramClient: () => ({
    sendMessage: mockSendMessage,
  }),
}));

// Mock the curried use-case: processChatMessage(deps) => (input) => result
const mockUseCaseExecutor = jest.fn();
jest.mock('../../application/use-cases/process-chat-message', () => ({
  processChatMessage: jest.fn(
    (_sendResponse: SendResponseFn): ProcessChatMessage => mockUseCaseExecutor
  ),
}));

// Import after mocks are set up (inline type imports to avoid duplicate-imports error)
import {
  processChatMessage,
  type ProcessChatMessage,
  type SendResponseFn,
} from '../../application/use-cases/process-chat-message';
import { baseHandler, type TelegramWebhookEvent } from './telegram-webhook';

const mockProcessChatMessage = processChatMessage as jest.MockedFunction<
  typeof processChatMessage
>;

// After parser middleware, the event IS the TelegramUpdate directly
const createEvent = (update: Record<string, unknown>): TelegramWebhookEvent =>
  update as TelegramWebhookEvent;

describe('Telegram Webhook Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation to default behavior
    mockProcessChatMessage.mockImplementation(
      (_sendResponse: SendResponseFn): ProcessChatMessage => mockUseCaseExecutor
    );
    mockUseCaseExecutor.mockResolvedValue({ success: true });
  });

  it('composes use-case with sendResponse and executes with event data', async () => {
    const user = TelegramUserBuilder.build();
    const chat = TelegramChatBuilder.build();
    const message = TelegramMessageBuilder.build({ from: user, chat });

    const response = await baseHandler(
      createEvent(TelegramUpdateBuilder.build({ message }))
    );

    expect(response.statusCode).toBe(200);

    // Verify composition: processChatMessage was called with sendResponse function
    expect(mockProcessChatMessage).toHaveBeenCalledWith(expect.any(Function));

    // Verify execution: the composed use-case was called with event data
    expect(mockUseCaseExecutor).toHaveBeenCalledWith({
      userId: user.id,
      chatId: chat.id,
      messageId: message.message_id,
      messageText: message.text,
      traceId: undefined,
    });
  });

  it('injects sendResponse that calls Telegram client via service', async () => {
    const message = TelegramMessageBuilder.build();

    // Capture the sendResponse function during composition
    mockProcessChatMessage.mockImplementation(
      (sendResponse: SendResponseFn): ProcessChatMessage =>
        async () => {
          await sendResponse({ text: 'Test response' });
          return {
            success: true,
            processed: { userId: 1, chatId: 1, messageLength: 1 },
            timestamp: new Date().toISOString(),
          };
        }
    );

    await baseHandler(createEvent(TelegramUpdateBuilder.build({ message })));

    // The service should have called the Telegram client
    expect(mockSendMessage).toHaveBeenCalledWith({
      chatId: message.chat.id,
      text: 'Test response',
      parseMode: undefined,
      replyToMessageId: message.message_id,
    });
  });

  it('acknowledges update without text', async () => {
    const message = TelegramMessageBuilder.build({ text: undefined });

    const response = await baseHandler(
      createEvent(TelegramUpdateBuilder.build({ message }))
    );

    expect(response.statusCode).toBe(200);
    expect(mockProcessChatMessage).not.toHaveBeenCalled();
    expect(JSON.parse(response.body).message).toBe('Update acknowledged');
  });

  it('processes edited_message when message is absent', async () => {
    const editedMessage = TelegramMessageBuilder.build();

    await baseHandler(
      createEvent({ update_id: 1, edited_message: editedMessage })
    );

    expect(mockUseCaseExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ messageText: editedMessage.text })
    );
  });

  it('uses userId 0 when from is missing', async () => {
    const chat = TelegramChatBuilder.build();
    const message = TelegramMessageBuilder.build({ chat });
    const update = {
      update_id: 1,
      message: {
        message_id: message.message_id,
        chat,
        date: message.date,
        text: message.text,
      },
    };

    await baseHandler(createEvent(update));

    expect(mockUseCaseExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 0 })
    );
  });

  it('propagates errors from use-case execution', async () => {
    const message = TelegramMessageBuilder.build();
    mockUseCaseExecutor.mockRejectedValue(new Error('Failed'));

    await expect(
      baseHandler(createEvent(TelegramUpdateBuilder.build({ message })))
    ).rejects.toThrow('Failed');
  });
});
