// ============================================================================
// Infrastructure - Prompt Definition Loader (Handlebars)
// ============================================================================

import Handlebars from 'handlebars';
import { agentReplyPrompts } from '../../../ai/prompts/imports';
import type { PromptEntry } from '../../../ai/prompts/types';

export type PromptCategory = 'agentReply';
export type AgentReplyFamily = keyof typeof agentReplyPrompts;

const DEFAULT_LANGUAGE = 'EN';

export type GetPromptDefinitionParams<F extends string, Input> = {
  family: F;
  templateParams: {
    version: string;
    language: string;
  };
  templateInput: Input;
};

export type GetPromptDefinitionResult = {
  structuredOutput: (...args: unknown[]) => unknown;
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

const listRegistryKeys = (registry: unknown): string => {
  if (!registry || typeof registry !== 'object') {
    return '';
  }

  return Object.keys(registry as Record<string, unknown>).join(', ');
};

const buildPromptNotFoundErrorMessage = (params: {
  family: string;
  version: string;
  language: string;
  familyRegistry: unknown;
  versionRegistry: unknown;
}): string => {
  const { family, version, language, familyRegistry, versionRegistry } = params;

  const base = `Prompt not found for path: agentReply/${family}/${version}/${language}`;

  const availableVersions = listRegistryKeys(familyRegistry);
  const availableLanguages = listRegistryKeys(versionRegistry);

  const details: string[] = [];
  if (availableVersions) {
    details.push(`available versions: ${availableVersions}`);
  }
  if (availableLanguages) {
    details.push(`available languages: ${availableLanguages}`);
  }

  if (details.length === 0) {
    return base;
  }

  return `${base} (${details.join(') (')})`;
};

const resolvePromptEntry = (
  versionRegistry: Record<string, PromptEntry> | undefined,
  language: string
): PromptEntry | undefined => {
  if (!versionRegistry) {
    return undefined;
  }

  const preferred = versionRegistry[language];
  if (preferred) {
    return preferred;
  }

  return versionRegistry[DEFAULT_LANGUAGE];
};

export const getPromptDefinition = <Input>(
  kind: PromptCategory,
  params: GetPromptDefinitionParams<AgentReplyFamily, Input>
): GetPromptDefinitionResult => {
  // Today PromptCategory only contains "agentReply", but we keep the argument for
  // forward compatibility with multiple prompt categories.
  void kind;

  const version = normalizeVersion(params.templateParams?.version);
  const language = normalizeLanguage(params.templateParams?.language);

  // NOTE: Prompts are authored per (family, version, language). We intentionally
  // fall back to EN if a given language is not available to avoid taking down
  // the webhook on missing i18n assets.
  const familyRegistry = agentReplyPrompts[params.family] as Record<
    string,
    Record<string, PromptEntry>
  >;
  const versionRegistry = familyRegistry?.[version] as
    | Record<string, PromptEntry>
    | undefined;
  const entry = resolvePromptEntry(versionRegistry, language);

  if (!entry) {
    throw new Error(
      buildPromptNotFoundErrorMessage({
        family: String(params.family),
        version,
        language,
        familyRegistry,
        versionRegistry,
      })
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
