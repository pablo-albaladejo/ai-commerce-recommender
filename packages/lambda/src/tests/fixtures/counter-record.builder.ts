import { faker } from '@faker-js/faker';
import { Factory } from 'rosie';
import type { CounterRecord } from '../../application/repositories/counter-repository';

export const CounterRecordBuilder = Factory.define<CounterRecord>(
  'CounterRecord'
)
  .attr('pk', () => faker.string.alphanumeric(20))
  .attr('count', () => faker.number.int({ min: 0, max: 100 }))
  .attr('window_start', () => Math.floor(Date.now() / 1000))
  .attr('ttl', () => Math.floor(Date.now() / 1000) + 3600)
  .attr('user_id', () => faker.number.int({ min: 100000, max: 999999999 }))
  .attr('date', () => new Date().toISOString().split('T')[0])
  .attr('created_at', () => new Date().toISOString())
  .attr('updated_at', () => new Date().toISOString())
  .attr('input_tokens', () => faker.number.int({ min: 0, max: 1000 }))
  .attr('output_tokens', () => faker.number.int({ min: 0, max: 1000 }));
