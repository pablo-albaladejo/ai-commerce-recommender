import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';
import type {
  ConversationContext,
  ConversationMessage,
} from '../../middleware/context/context-manager';

export const ConversationMessageBuilder = Factory.define<ConversationMessage>(
  'ConversationMessage'
)
  .attr('role', () => faker.helpers.arrayElement(['user', 'agent'] as const))
  .attr('content', () => faker.lorem.sentence())
  .attr('timestamp', () => new Date().toISOString())
  .attr('tokenCount', () => faker.number.int({ min: 10, max: 100 }));

export const ConversationContextBuilder = Factory.define<ConversationContext>(
  'ConversationContext'
)
  .attr('messages', () =>
    ConversationMessageBuilder.buildList(faker.number.int({ min: 1, max: 6 }))
  )
  .attr('summary', () => faker.lorem.paragraph())
  .attr('totalTokens', () => faker.number.int({ min: 100, max: 4000 }));
