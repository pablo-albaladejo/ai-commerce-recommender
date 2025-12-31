import { textContent } from '../../domain/agent/content';
import { AgentTurnOutputBuilder } from '../../tests/fixtures/agent-turn.builder';
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

// Mock the curried use-case: processChatMessage(emitAction, runAgentTurn) => (input) => result
const mockUseCaseExecutor = jest.fn();
jest.mock('../../application/use-cases/process-chat-message', () => ({
  processChatMessage: jest.fn(() => mockUseCaseExecutor),
}));

// Import after mocks are set up (inline type imports to avoid duplicate-imports error)
import type { RunAgentTurn } from '../../application/services/agent-engine-service';
import {
  processChatMessage,
  type EmitAgentAction,
  type ProcessChatMessage,
} from '../../application/use-cases/process-chat-message';
import type { TelegramUpdate } from '../../infrastructure/telegram/telegram-schemas';
import { baseHandler } from './telegram-webhook';

const mockProcessChatMessage = processChatMessage as jest.MockedFunction<
  typeof processChatMessage
>;

// After parser middleware, the event IS the TelegramUpdate directly
const createEvent = (update: Record<string, unknown>): TelegramUpdate =>
  update as TelegramUpdate;

describe('Telegram Webhook Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation to default behavior
    mockProcessChatMessage.mockImplementation(
      (
        _emitAction: EmitAgentAction,
        _runAgentTurn: RunAgentTurn
      ): ProcessChatMessage => mockUseCaseExecutor
    );
    mockUseCaseExecutor.mockResolvedValue(
      AgentTurnOutputBuilder.build({ actions: [] })
    );
  });

  it('composes use-case with sendResponse and executes with event data', async () => {
    const user = TelegramUserBuilder.build();
    const chat = TelegramChatBuilder.build();
    const message = TelegramMessageBuilder.build({ from: user, chat });

    const response = await baseHandler(
      createEvent(TelegramUpdateBuilder.build({ message }))
    );

    expect(response.statusCode).toBe(200);

    // Verify composition: processChatMessage was called with two injected dependencies
    expect(mockProcessChatMessage).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function)
    );

    // Verify execution: the composed use-case was called with event data
    expect(mockUseCaseExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'telegram',
        actor: expect.objectContaining({ id: String(user.id), kind: 'user' }),
        conversation: expect.objectContaining({ id: String(chat.id) }),
        event: expect.objectContaining({ type: 'user_message' }),
      })
    );
  });

  it('injects sendResponse that calls Telegram client via service', async () => {
    const message = TelegramMessageBuilder.build();

    // Capture the emitAction function during composition
    mockProcessChatMessage.mockImplementation(
      (emitAction: EmitAgentAction): ProcessChatMessage =>
        async () => {
          const action = {
            type: 'send_message',
            content: textContent('Test response'),
          } as const;

          await emitAction(action);
          return {
            actions: [action],
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
    const editedMessage = TelegramMessageBuilder.build({
      text: 'Edited message',
    });

    await baseHandler(
      createEvent({ update_id: 1, edited_message: editedMessage })
    );

    expect(mockUseCaseExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'user_message',
          content: textContent('Edited message'),
        }),
      })
    );
  });

  it('uses chat.id as userId when from is missing', async () => {
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
      expect.objectContaining({
        actor: expect.objectContaining({ id: String(chat.id) }),
      })
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
