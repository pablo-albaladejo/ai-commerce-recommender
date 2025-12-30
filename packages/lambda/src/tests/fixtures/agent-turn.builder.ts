import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';
import { textContent } from '../../domain/agent/content';
import type { AgentAction } from '../../domain/agent/actions';
import type {
  UserCommandEvent,
  UserMessageEvent,
  UserSelectionEvent,
} from '../../domain/agent/events';
import type {
  ActorRef,
  ChannelScopedId,
  ConversationRef,
} from '../../domain/agent/ids';
import type { AgentTurnInput } from '../../domain/agent/turn';
import type { AgentTurnOutput } from '../../application/services/agent-engine-service';

export const ChannelScopedIdBuilder = Factory.define<ChannelScopedId>(
  'ChannelScopedId'
)
  .attr('channel', 'telegram')
  .attr('id', () => faker.string.numeric(6));

export const ActorRefBuilder = Factory.define<ActorRef>('ActorRef')
  .attr('channel', 'telegram')
  .attr('id', () => faker.string.numeric(6))
  .attr('kind', 'user');

export const ConversationRefBuilder = Factory.define<ConversationRef>(
  'ConversationRef'
)
  .attr('channel', 'telegram')
  .attr('id', () => faker.string.numeric(6));

export const UserMessageEventBuilder = Factory.define<UserMessageEvent>(
  'UserMessageEvent'
)
  .attr('type', 'user_message')
  .attr('eventId', () => ChannelScopedIdBuilder.build())
  .attr('timestamp', () => faker.date.recent().toISOString())
  .attr('content', () => textContent(faker.lorem.sentence()));

export const UserSelectionEventBuilder = Factory.define<UserSelectionEvent>(
  'UserSelectionEvent'
)
  .attr('type', 'user_selection')
  .attr('eventId', () => ChannelScopedIdBuilder.build())
  .attr('timestamp', () => faker.date.recent().toISOString())
  .attr('selection', () => ({
    id: faker.string.alphanumeric(8),
    label: faker.commerce.productName(),
    value: faker.string.alphanumeric(8),
  }));

export const UserCommandEventBuilder = Factory.define<UserCommandEvent>(
  'UserCommandEvent'
)
  .attr('type', 'user_command')
  .attr('eventId', () => ChannelScopedIdBuilder.build())
  .attr('timestamp', () => faker.date.recent().toISOString())
  .attr('command', () => ({
    name: faker.lorem.word(),
    args: [faker.lorem.word(), faker.lorem.word()],
  }));

export type SendMessageAction = Extract<AgentAction, { type: 'send_message' }>;

export const SendMessageActionBuilder = Factory.define<SendMessageAction>(
  'SendMessageAction'
)
  .attr('type', 'send_message')
  .attr('content', () => textContent(faker.lorem.sentence()));

export type AgentTurnLlmTokenUsage = NonNullable<
  NonNullable<AgentTurnOutput['llm']>['tokenUsage']
>;
export const AgentTurnLlmTokenUsageBuilder =
  Factory.define<AgentTurnLlmTokenUsage>('AgentTurnLlmTokenUsage')
    .attr('inputTokens', () => faker.number.int({ min: 1, max: 500 }))
    .attr('outputTokens', () => faker.number.int({ min: 1, max: 500 }))
    .attr(
      'totalTokens',
      ['inputTokens', 'outputTokens'],
      (inputTokens, outputTokens) => inputTokens + outputTokens
    );

export type AgentTurnLlmInfo = NonNullable<AgentTurnOutput['llm']>;
export const AgentTurnLlmInfoBuilder = Factory.define<AgentTurnLlmInfo>(
  'AgentTurnLlmInfo'
)
  .attr('modelId', () => `test-model-${faker.string.alphanumeric(6)}`)
  .attr('finishReason', 'stop')
  .attr('tokenUsage', () => AgentTurnLlmTokenUsageBuilder.build());

export const AgentTurnOutputBuilder = Factory.define<AgentTurnOutput>(
  'AgentTurnOutput'
)
  .attr('actions', () => [SendMessageActionBuilder.build()])
  .attr('llm', () => AgentTurnLlmInfoBuilder.build());

export const AgentTurnInputBuilder = Factory.define<AgentTurnInput>(
  'AgentTurnInput'
)
  .attr('channel', 'telegram')
  .attr('actor', () => ActorRefBuilder.build())
  .attr('conversation', () => ConversationRefBuilder.build())
  .attr('event', () => UserMessageEventBuilder.build())
  .attr('locale', () => faker.helpers.arrayElement(['en', 'es', 'fr']));
