// ============================================================================
// AI Prompts - Shared Types (Registry-centric)
// ============================================================================

import type { ZodType } from 'zod';

export type PromptVersion = string;
export type PromptLanguage = string;
export type PromptFamily = string;

export type PromptMetadata = {
  key: string;
  language: PromptLanguage;
  version: PromptVersion;
};

export type PromptText = {
  metadata: PromptMetadata;
  prompt: string;
};

/**
 * A prompt entry represents exactly one concrete prompt path:
 * {category}/{family}/{version}/{language}/
 */
export type PromptEntry = {
  structuredOutput: (...args: unknown[]) => ZodType;
  systemPrompt: PromptText;
  userPrompt: PromptText;
};

/**
 * Generic registry shape for a category.
 */
export type PromptStructV1<F extends PromptFamily> = Record<
  F,
  Record<PromptVersion, Record<PromptLanguage, PromptEntry>>
>;
