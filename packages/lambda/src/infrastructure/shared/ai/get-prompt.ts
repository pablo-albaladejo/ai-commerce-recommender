// ============================================================================
// Infrastructure - Prompt Definition Loader (Handlebars)
// ============================================================================

import Handlebars from 'handlebars';
import { agentReplyPrompts } from '../../../ai/prompts/imports';

export type PromptCategory = 'agentReply';
export type AgentReplyFamily = keyof typeof agentReplyPrompts;

export type GetPromptDefinitionParams<F extends string, Input> = {
  family: F;
  templateParams: {
    version: string;
    language: string;
  };
  templateInput: Input;
};

export type GetPromptDefinitionResult = {
  structuredOutput: (...args: any[]) => unknown;
  systemPrompt: {
    metadata: { key: string; language: string; version: string };
    prompt: string;
  };
  userPrompt: {
    metadata: { key: string; language: string; version: string };
    prompt: string;
  };
};

const normalizeVersion = (version: string | undefined): string =>
  version ?? 'v1';
const normalizeLanguage = (language: string | undefined): string => {
  return (language ?? 'en').split('-')[0].toUpperCase();
};

const compilePrompt = (template: string, input: unknown): string => {
  const compiled = Handlebars.compile(template, { strict: true });
  return compiled({ input });
};

export const getPromptDefinition = <Input>(
  kind: PromptCategory,
  params: GetPromptDefinitionParams<AgentReplyFamily, Input>
): GetPromptDefinitionResult => {
  if (kind !== 'agentReply') {
    throw new Error(`Unsupported prompt category: ${kind}`);
  }

  const version = normalizeVersion(params.templateParams?.version);
  const language = normalizeLanguage(params.templateParams?.language);

  const entry = // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (agentReplyPrompts as any)[params.family]?.[version]?.[language];

  if (!entry) {
    throw new Error(
      `Prompt not found for path: agentReply/${String(params.family)}/${version}/${language}`
    );
  }

  return {
    structuredOutput: entry.structuredOutput,
    systemPrompt: {
      metadata: entry.systemPrompt.metadata,
      prompt: compilePrompt(entry.systemPrompt.prompt, params.templateInput),
    },
    userPrompt: {
      metadata: entry.userPrompt.metadata,
      prompt: compilePrompt(entry.userPrompt.prompt, params.templateInput),
    },
  };
};
