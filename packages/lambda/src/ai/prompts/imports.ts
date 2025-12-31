// ============================================================================
// AI Prompts - Registry (Static Imports)
// ============================================================================

import { agentReplyCommandStructuredOutputV1 } from './agent-reply/command/v1/en/structured-output';
import agentReplyCommandV1EnSystemPrompt from './agent-reply/command/v1/en/system-prompt.md';
import agentReplyCommandV1EnUserPrompt from './agent-reply/command/v1/en/user-prompt.md';
import { agentReplyMessageStructuredOutputV1 } from './agent-reply/message/v1/en/structured-output';
import agentReplyMessageV1EnSystemPrompt from './agent-reply/message/v1/en/system-prompt.md';
import agentReplyMessageV1EnUserPrompt from './agent-reply/message/v1/en/user-prompt.md';
import { agentReplySelectionStructuredOutputV1 } from './agent-reply/selection/v1/en/structured-output';
import agentReplySelectionV1EnSystemPrompt from './agent-reply/selection/v1/en/system-prompt.md';
import agentReplySelectionV1EnUserPrompt from './agent-reply/selection/v1/en/user-prompt.md';
import type { PromptEntry, PromptStructV1 } from './types';

export type Version = 'v1';
export type Language = 'EN';
export type AgentReplyFamily = 'message' | 'selection' | 'command';

const entry = (params: {
  keyBase: string;
  version: Version;
  language: Language;
  systemPrompt: string;
  userPrompt: string;
  structuredOutput: PromptEntry['structuredOutput'];
}): PromptEntry => {
  const {
    keyBase,
    version,
    language,
    systemPrompt,
    userPrompt,
    structuredOutput,
  } = params;

  return {
    structuredOutput,
    systemPrompt: {
      metadata: { key: `${keyBase}_system-prompt`, language, version },
      prompt: systemPrompt,
    },
    userPrompt: {
      metadata: { key: `${keyBase}_user-prompt`, language, version },
      prompt: userPrompt,
    },
  };
};

/**
 * Central registry of all prompts.
 *
 * The folder convention is: {category}/{family}/{version}/{language}/
 * Each prompt has exactly 3 files:
 * - system-prompt.md
 * - user-prompt.md
 * - structured-output.ts
 */
export const agentReplyPrompts: PromptStructV1<AgentReplyFamily> = {
  message: {
    v1: {
      EN: entry({
        keyBase: 'agentReply_message_v1_EN',
        version: 'v1',
        language: 'EN',
        structuredOutput: agentReplyMessageStructuredOutputV1,
        systemPrompt: agentReplyMessageV1EnSystemPrompt,
        userPrompt: agentReplyMessageV1EnUserPrompt,
      }),
    },
  },
  selection: {
    v1: {
      EN: entry({
        keyBase: 'agentReply_selection_v1_EN',
        version: 'v1',
        language: 'EN',
        structuredOutput: agentReplySelectionStructuredOutputV1,
        systemPrompt: agentReplySelectionV1EnSystemPrompt,
        userPrompt: agentReplySelectionV1EnUserPrompt,
      }),
    },
  },
  command: {
    v1: {
      EN: entry({
        keyBase: 'agentReply_command_v1_EN',
        version: 'v1',
        language: 'EN',
        structuredOutput: agentReplyCommandStructuredOutputV1,
        systemPrompt: agentReplyCommandV1EnSystemPrompt,
        userPrompt: agentReplyCommandV1EnUserPrompt,
      }),
    },
  },
};
