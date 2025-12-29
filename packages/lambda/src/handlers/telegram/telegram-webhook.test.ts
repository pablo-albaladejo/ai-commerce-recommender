import { defaultTelegramClient } from '../../infrastructure/telegram/telegram-client';
import {
  TelegramChatBuilder,
  TelegramMessageBuilder,
  TelegramUpdateBuilder,
  TelegramUserBuilder,
} from '../../tests/fixtures/telegram-message.builder';

// Mock Telegram client
jest.mock('../../infrastructure/telegram/telegram-client', () => ({
  defaultTelegramClient: {
    sendMessage: jest.fn().mockResolvedValue(true),
  },
}));

const mockProcessTelegramMessage = jest.fn();
jest.mock('../../application/use-cases/process-telegram-message', () => ({
  processTelegramMessage: (...args: unknown[]) =>
    mockProcessTelegramMessage(...args),
}));

import { baseHandler, type TelegramWebhookEvent } from './telegram-webhook';

// After parser middleware, the event IS the TelegramUpdate directly
const createEvent = (update: Record<string, unknown>): TelegramWebhookEvent =>
  update as TelegramWebhookEvent;

describe('Telegram Webhook Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessTelegramMessage.mockResolvedValue({ success: true });
  });

  it('processes text message and calls processTelegramMessage', async () => {
    const user = TelegramUserBuilder.build();
    const chat = TelegramChatBuilder.build();
    const message = TelegramMessageBuilder.build({ from: user, chat });

    const response = await baseHandler(
      createEvent(TelegramUpdateBuilder.build({ message }))
    );

    expect(response.statusCode).toBe(200);
    expect(mockProcessTelegramMessage).toHaveBeenCalledWith({
      userId: user.id,
      chatId: chat.id,
      messageId: message.message_id,
      messageText: message.text,
      traceId: undefined,
    });
  });

  it('sends response to Telegram when processTelegramMessage succeeds', async () => {
    const message = TelegramMessageBuilder.build();
    mockProcessTelegramMessage.mockResolvedValue({
      success: true,
      response: { text: 'Bot response' },
    });

    await baseHandler(createEvent(TelegramUpdateBuilder.build({ message })));

    expect(defaultTelegramClient.sendMessage).toHaveBeenCalledWith({
      chatId: message.chat.id,
      text: 'Bot response',
      replyToMessageId: message.message_id,
    });
  });

  it('acknowledges update without text', async () => {
    const message = TelegramMessageBuilder.build({ text: undefined });

    const response = await baseHandler(
      createEvent(TelegramUpdateBuilder.build({ message }))
    );

    expect(response.statusCode).toBe(200);
    expect(mockProcessTelegramMessage).not.toHaveBeenCalled();
    expect(JSON.parse(response.body).message).toBe('Update acknowledged');
  });

  it('processes edited_message when message is absent', async () => {
    const editedMessage = TelegramMessageBuilder.build();

    await baseHandler(
      createEvent({ update_id: 1, edited_message: editedMessage })
    );

    expect(mockProcessTelegramMessage).toHaveBeenCalledWith(
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

    expect(mockProcessTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 0 })
    );
  });

  it('propagates errors from processTelegramMessage', async () => {
    const message = TelegramMessageBuilder.build();
    mockProcessTelegramMessage.mockRejectedValue(new Error('Failed'));

    await expect(
      baseHandler(createEvent(TelegramUpdateBuilder.build({ message })))
    ).rejects.toThrow('Failed');
  });
});
