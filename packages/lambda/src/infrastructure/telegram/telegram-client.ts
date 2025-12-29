// ============================================================================
// Telegram API Client
// ============================================================================

export type SendMessageParams = {
  chatId: number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyToMessageId?: number;
};

export type TelegramClientConfig = {
  botToken: string;
};

export type TelegramClient = {
  sendMessage: (params: SendMessageParams) => Promise<boolean>;
};

// ============================================================================
// Factory
// ============================================================================

export const createTelegramClient = (
  config: TelegramClientConfig
): TelegramClient => {
  const { botToken } = config;
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  const sendMessage = async (params: SendMessageParams): Promise<boolean> => {
    const url = `${baseUrl}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.text,
        parse_mode: params.parseMode,
        reply_to_message_id: params.replyToMessageId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send Telegram message:', error);
      return false;
    }

    return true;
  };

  return { sendMessage };
};

// ============================================================================
// Default Instance
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export const defaultTelegramClient: TelegramClient = createTelegramClient({
  botToken: TELEGRAM_BOT_TOKEN,
});
