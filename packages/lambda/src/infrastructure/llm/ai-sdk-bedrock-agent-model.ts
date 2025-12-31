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
import { contentToPlainText, textContent } from '../../domain/agent/content';
import type { AgentMessage } from '../../domain/agent/message';

export type AiSdkBedrockAgentModelConfig = {
  modelId: string;
  region: string;
  maxOutputTokens: number;
  temperature: number;
  systemPrompt: string;
};

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful, concise commerce agent. Answer the user in the same language as their message.';

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

const resolveSystemPrompt = (
  overrides: Partial<AiSdkBedrockAgentModelConfig>
): string => overrides.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

type AiSdkUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

const toTokenUsage = (
  usage: AiSdkUsage | undefined
): TokenUsage | undefined => {
  if (!usage) return undefined;

  const inputTokens = usage.promptTokens ?? 0;
  const outputTokens = usage.completionTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

  return { inputTokens, outputTokens, totalTokens };
};

type AiSdkMessage = { role: 'user' | 'assistant'; content: string };

const toAiSdkMessages = (messages: AgentMessage[]): AiSdkMessage[] => {
  return messages.map(m => ({
    role: m.role === 'agent' ? 'assistant' : 'user',
    content: contentToPlainText(m.content),
  }));
};

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
    const system = input.systemPrompt ?? config.systemPrompt;
    const { text, usage, finishReason } = await generateText({
      model,
      system,
      messages: toAiSdkMessages(input.messages),
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
    });

    return {
      message: { role: 'agent', content: textContent(text) },
      modelId: config.modelId,
      finishReason,
      tokenUsage: toTokenUsage(usage as AiSdkUsage | undefined),
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
    systemPrompt: resolveSystemPrompt(overrides),
  });

  return async (input: AgentModelInput): Promise<AgentModelOutput> => {
    if (!cached) {
      cached = createAiSdkBedrockAgentModel(resolveConfigFromEnv());
    }

    return cached(input);
  };
};
