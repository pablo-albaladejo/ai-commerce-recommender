// ============================================================================
// AI SDK (v6) + Amazon Bedrock - Agent Model Adapter (Infrastructure)
// ============================================================================

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';
import type {
  AgentModelInput,
  AgentModelOutput,
  GenerateAgentReply,
  TokenUsage,
} from '../../application/services/agent-model-service';
import { normalizeLocale } from '../../application/services/translation-service';
import { contentToPlainText, textContent } from '../../domain/agent/content';
import type { AgentMessage } from '../../domain/agent/message';
import { createTranslationService } from '../i18n/translation-service';

export type AiSdkBedrockAgentModelConfig = {
  modelId: string;
  region: string;
  maxOutputTokens: number;
  temperature: number;
};

const requireString = (
  value: string | undefined,
  errorMessage: string
): string => {
  if (!value) throw new Error(errorMessage);
  return value;
};

const resolveModelId = (
  overrides: Partial<AiSdkBedrockAgentModelConfig>
): string | undefined => overrides.modelId ?? process.env.CLAUDE_MODEL_ID;

const resolveRegion = (
  overrides: Partial<AiSdkBedrockAgentModelConfig>
): string | undefined =>
  overrides.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

const resolveMaxOutputTokens = (
  overrides: Partial<AiSdkBedrockAgentModelConfig>
): number => overrides.maxOutputTokens ?? 500;

const resolveTemperature = (
  overrides: Partial<AiSdkBedrockAgentModelConfig>
): number => overrides.temperature ?? 0.7;

const numberOrZero = (value: number | undefined): number => value ?? 0;

const toTokenUsage = (
  usage:
    | {
        inputTokens?: number;
        outputTokens?: number;
      }
    | undefined
): TokenUsage | undefined => {
  if (!usage) return undefined;
  const inputTokens = numberOrZero(usage.inputTokens);
  const outputTokens = numberOrZero(usage.outputTokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
};

type AiSdkMessage = { role: 'user' | 'assistant'; content: string };

const toAiSdkMessages = (messages: AgentMessage[]): AiSdkMessage[] => {
  return messages.map(m => {
    return {
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: contentToPlainText(m.content),
    };
  });
};

const isCommerceGuardrailEnabled = (): boolean =>
  (process.env.COMMERCE_GUARDRAIL_ENABLED ?? 'false').toLowerCase() === 'true';

export const createAiSdkBedrockAgentModel = (
  config: AiSdkBedrockAgentModelConfig
): GenerateAgentReply => {
  const provider = createAmazonBedrock({ region: config.region });

  // NOTE: Some tooling setups can resolve mismatched @ai-sdk/provider versions in a pnpm monorepo.
  // The runtime model object is compatible with AI SDK `generateText`, so we keep this cast local.
  const model = provider(config.modelId) as unknown as Parameters<
    typeof generateText
  >[0]['model'];

  return async (input: AgentModelInput): Promise<AgentModelOutput> => {
    // Prompts are resolved upstream via the prompt registry (`getPromptDefinition`).
    // This adapter should not own prompt content; it only passes through the system prompt.
    const system = input.systemPrompt;

    const { text, usage, finishReason, rawFinishReason } = await generateText({
      model,
      system,
      messages: toAiSdkMessages(input.messages),
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
    });

    // If an account/org-level Bedrock guardrail is enforced, Bedrock can return
    // `guardrail_intervened` as raw finish reason. In that case, we return our
    // localized refusal message (instead of provider/default text).
    let finalText = text;
    if (isCommerceGuardrailEnabled()) {
      if (rawFinishReason === 'guardrail_intervened') {
        finalText = createTranslationService(normalizeLocale(input.locale)).t(
          'message.outOfScopeCommerce'
        );
      }
    }

    return {
      message: { role: 'agent', content: textContent(finalText) },
      modelId: config.modelId,
      finishReason,
      tokenUsage: toTokenUsage(usage),
    };
  };
};

/**
 * Convenience factory for Lambda usage (env-driven, cached across warm invocations).
 *
 * IMPORTANT: This is designed to not throw at import time (so unit tests can
 * import handlers without setting env vars). It throws only when invoked.
 */
export const createAiSdkBedrockAgentModelFromEnv = (
  overrides: Partial<AiSdkBedrockAgentModelConfig> = {}
): GenerateAgentReply => {
  let cached: GenerateAgentReply | null = null;

  const resolveConfigFromEnv = (): AiSdkBedrockAgentModelConfig => ({
    modelId: requireString(
      resolveModelId(overrides),
      'Missing required env var: CLAUDE_MODEL_ID (Bedrock chat model id)'
    ),
    region: requireString(
      resolveRegion(overrides),
      'Missing required env var: AWS_REGION (or AWS_DEFAULT_REGION)'
    ),
    maxOutputTokens: resolveMaxOutputTokens(overrides),
    temperature: resolveTemperature(overrides),
  });

  return async (input: AgentModelInput): Promise<AgentModelOutput> => {
    if (!cached) {
      cached = createAiSdkBedrockAgentModel(resolveConfigFromEnv());
    }

    return cached(input);
  };
};
