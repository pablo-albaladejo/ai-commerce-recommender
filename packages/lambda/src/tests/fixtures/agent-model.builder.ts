import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';
import type {
  AgentModelOutput,
  TokenUsage,
} from '../../application/services/agent-model-service';
import { textContent } from '../../domain/agent/content';
import type { AgentMessage } from '../../domain/agent/message';

export const TokenUsageBuilder = Factory.define<TokenUsage>('TokenUsage')
  .attr('inputTokens', () => faker.number.int({ min: 1, max: 500 }))
  .attr('outputTokens', () => faker.number.int({ min: 1, max: 500 }))
  .attr(
    'totalTokens',
    ['inputTokens', 'outputTokens'],
    (inputTokens, outputTokens) => inputTokens + outputTokens
  );

export const AgentMessageBuilder = Factory.define<AgentMessage>('AgentMessage')
  .attr('role', 'agent')
  .attr('content', () => textContent(faker.lorem.sentence()));

export const AgentModelOutputBuilder = Factory.define<AgentModelOutput>(
  'AgentModelOutput'
)
  .attr('message', () => AgentMessageBuilder.build())
  .attr('modelId', () => `test-model-${faker.string.alphanumeric(6)}`)
  .attr('finishReason', 'stop')
  .attr('tokenUsage', () => TokenUsageBuilder.build());
