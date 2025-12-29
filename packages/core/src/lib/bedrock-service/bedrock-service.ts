import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';

export type BedrockServiceConfig = {
  region?: string;
  modelId: string;
  maxRetries?: number;
  timeoutMs?: number;
};

type ClaudeRequest = {
  prompt: string;
  max_tokens_to_sample: number;
  temperature: number;
  top_p: number;
  stop_sequences: string[];
  anthropic_version?: string;
};

type ClaudeResponse = {
  completion: string;
  stop_reason: 'stop_sequence' | 'max_tokens' | 'end_turn';
  stop?: string;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LLMGenerationResult = {
  text: string;
  tokenUsage: TokenUsage;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  modelId: string;
  requestId?: string;
};

type GenerateOptions = {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
};

export class BedrockService {
  private readonly client: BedrockRuntimeClient;
  private readonly config: BedrockServiceConfig;

  constructor(config: BedrockServiceConfig) {
    this.config = { maxRetries: 3, timeoutMs: 30000, ...config };
    this.client = new BedrockRuntimeClient({
      region: this.config.region || process.env.AWS_REGION || 'us-east-1',
      maxAttempts: this.config.maxRetries,
      requestHandler: { requestTimeout: this.config.timeoutMs },
    });
  }

  async generateText(
    prompt: string,
    options: GenerateOptions = {}
  ): Promise<LLMGenerationResult> {
    try {
      const claudeRequest = this.buildClaudeRequest(prompt, options);
      const response = await this.invokeModel(claudeRequest);
      return this.parseResponse(response, claudeRequest.prompt);
    } catch (error) {
      throw new Error(
        `Bedrock service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private buildClaudeRequest(
    prompt: string,
    options: GenerateOptions
  ): ClaudeRequest {
    const {
      maxTokens = 500,
      temperature = 0.7,
      topP = 0.9,
      stopSequences = [],
      systemPrompt,
    } = options;
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\nHuman: ${prompt}\n\nAssistant:`
      : `Human: ${prompt}\n\nAssistant:`;
    return {
      prompt: fullPrompt,
      max_tokens_to_sample: maxTokens,
      temperature,
      top_p: topP,
      stop_sequences: [...stopSequences, '\n\nHuman:'],
      anthropic_version: 'bedrock-2023-05-31',
    };
  }

  private async invokeModel(
    claudeRequest: ClaudeRequest
  ): Promise<InvokeModelCommandOutput> {
    const command: InvokeModelCommandInput = {
      modelId: this.config.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(claudeRequest),
    };
    return this.client.send(new InvokeModelCommand(command));
  }

  private parseResponse(
    response: InvokeModelCommandOutput,
    fullPrompt: string
  ): LLMGenerationResult {
    if (!response.body)
      throw new Error('No response body received from Bedrock');
    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body)
    ) as ClaudeResponse;
    const inputTokens = this.estimateTokenCount(fullPrompt);
    const outputTokens = this.estimateTokenCount(responseBody.completion);
    return {
      text: responseBody.completion.trim(),
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      finishReason: this.mapStopReason(responseBody.stop_reason),
      modelId: this.config.modelId,
      requestId: response.$metadata.requestId,
    };
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private mapStopReason(
    stopReason: ClaudeResponse['stop_reason']
  ): 'stop' | 'length' | 'content_filter' | 'error' {
    return ['stop_sequence', 'end_turn'].includes(stopReason)
      ? 'stop'
      : stopReason === 'max_tokens'
        ? 'length'
        : 'error';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.generateText('Hello', { maxTokens: 10 });
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): BedrockServiceConfig {
    return { ...this.config };
  }
}
