import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Factory } from 'rosie';
import {
  APIGatewayProxyEventBuilder,
  LambdaContextBuilder,
} from './api-event.builder';
import type { MiddyRequest } from './middy-mock';

export type { MiddyRequest };

export const MiddyRequestBuilder = Factory.define<
  MiddyRequest<APIGatewayProxyEvent, unknown, Error, Context>
>('MiddyRequest')
  .attr('event', () => APIGatewayProxyEventBuilder.build())
  .attr('context', () => LambdaContextBuilder.build())
  .attr('response', null)
  .attr('error', null)
  .attr('internal', () => ({}));
