import { getPromptDefinition } from './get-prompt';

describe('getPromptDefinition', () => {
  test('falls back to EN when requested language is not present (e.g., ES)', () => {
    const result = getPromptDefinition('agentReply', {
      family: 'message',
      templateParams: { version: 'v1', language: 'ES' },
      templateInput: { text: 'hola', replyLanguage: 'ES' },
    });

    expect(result.systemPrompt.metadata.language).toBe('EN');
    expect(result.userPrompt.metadata.language).toBe('EN');
    expect(result.systemPrompt.metadata.version).toBe('v1');
    expect(result.userPrompt.metadata.version).toBe('v1');
    expect(result.systemPrompt.metadata.key).toBe(
      'agentReply_message_v1_EN_system-prompt'
    );
    expect(result.userPrompt.metadata.key).toBe(
      'agentReply_message_v1_EN_user-prompt'
    );

    // Markdown imports are mapped to a stable test fixture value in Jest.
    expect(result.systemPrompt.prompt).toBe('MOCK_MARKDOWN');
    expect(result.userPrompt.prompt).toBe('MOCK_MARKDOWN');
  });

  test('falls back to EN when requested language is not present', () => {
    const result = getPromptDefinition('agentReply', {
      family: 'message',
      templateParams: { version: 'v1', language: 'FR' },
      templateInput: { text: 'bonjour', replyLanguage: 'FR' },
    });

    expect(result.systemPrompt.metadata.language).toBe('EN');
    expect(result.userPrompt.metadata.language).toBe('EN');
    expect(result.systemPrompt.metadata.version).toBe('v1');
    expect(result.userPrompt.metadata.version).toBe('v1');
  });
});
