import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramMessage = {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: Array<TelegramMessageEntity>;
};

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramChat = {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramMessageEntity = {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
};

export const TelegramUserBuilder = Factory.define<TelegramUser>('TelegramUser')
  .attr('id', () => faker.number.int({ min: 100000, max: 999999999 }))
  .attr('is_bot', false)
  .attr('first_name', () => faker.person.firstName())
  .attr('last_name', () => faker.person.lastName())
  .attr('username', () => faker.internet.userName())
  .attr('language_code', 'en');

export const TelegramChatBuilder = Factory.define<TelegramChat>('TelegramChat')
  .attr('id', () => faker.number.int({ min: -999999999, max: 999999999 }))
  .attr('type', 'private')
  .attr('first_name', () => faker.person.firstName())
  .attr('last_name', () => faker.person.lastName())
  .attr('username', () => faker.internet.userName());

export const TelegramMessageBuilder = Factory.define<TelegramMessage>(
  'TelegramMessage'
)
  .attr('message_id', () => faker.number.int({ min: 1, max: 999999 }))
  .attr('from', () => TelegramUserBuilder.build())
  .attr('chat', () => TelegramChatBuilder.build())
  .attr('date', () => Math.floor(Date.now() / 1000))
  .attr('text', () => faker.lorem.sentence());

export const TelegramCallbackQueryBuilder =
  Factory.define<TelegramCallbackQuery>('TelegramCallbackQuery')
    .attr('id', () => faker.string.alphanumeric(20))
    .attr('from', () => TelegramUserBuilder.build())
    .attr('message', () => TelegramMessageBuilder.build())
    .attr('data', () => faker.string.alphanumeric(10));

export const TelegramUpdateBuilder = Factory.define<TelegramUpdate>(
  'TelegramUpdate'
)
  .attr('update_id', () => faker.number.int({ min: 1, max: 999999999 }))
  .attr('message', () => TelegramMessageBuilder.build());

export const TelegramCallbackUpdateBuilder = Factory.define<TelegramUpdate>(
  'TelegramCallbackUpdate'
)
  .attr('update_id', () => faker.number.int({ min: 1, max: 999999999 }))
  .attr('callback_query', () => TelegramCallbackQueryBuilder.build());
