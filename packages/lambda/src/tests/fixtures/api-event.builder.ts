import { faker } from '@faker-js/faker';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Factory } from 'rosie';

export const APIGatewayProxyEventBuilder = Factory.define<APIGatewayProxyEvent>(
  'APIGatewayProxyEvent'
)
  .attr('resource', '/webhook')
  .attr('path', '/webhook')
  .attr('httpMethod', 'POST')
  .attr('headers', () => ({
    'Content-Type': 'application/json',
    'User-Agent': faker.internet.userAgent(),
    'X-Forwarded-For': faker.internet.ip(),
  }))
  .attr('multiValueHeaders', {})
  .attr('queryStringParameters', null)
  .attr('multiValueQueryStringParameters', null)
  .attr('pathParameters', null)
  .attr('stageVariables', null)
  .attr('requestContext', () => ({
    resourceId: faker.string.alphanumeric(6),
    resourcePath: '/webhook',
    httpMethod: 'POST',
    extendedRequestId: faker.string.alphanumeric(20),
    requestTime: faker.date.recent().toISOString(),
    path: '/webhook',
    accountId: faker.string.numeric(12),
    protocol: 'HTTP/1.1',
    stage: 'prod',
    domainPrefix: faker.internet.domainWord(),
    requestTimeEpoch: Date.now(),
    requestId: faker.string.uuid(),
    identity: {
      cognitoIdentityPoolId: null,
      accountId: null,
      cognitoIdentityId: null,
      caller: null,
      sourceIp: faker.internet.ip(),
      principalOrgId: null,
      accessKey: null,
      cognitoAuthenticationType: null,
      cognitoAuthenticationProvider: null,
      userArn: null,
      userAgent: faker.internet.userAgent(),
      user: null,
      apiKey: null,
      apiKeyId: null,
      clientCert: null,
    },
    domainName: faker.internet.domainName(),
    apiId: faker.string.alphanumeric(10),
    authorizer: null,
  }))
  .attr('body', null)
  .attr('isBase64Encoded', false);

export const LambdaContextBuilder = Factory.define<Context>('LambdaContext')
  .attr('callbackWaitsForEmptyEventLoop', true)
  .attr('functionName', () => faker.lorem.word())
  .attr('functionVersion', '$LATEST')
  .attr(
    'invokedFunctionArn',
    () =>
      `arn:aws:lambda:us-east-1:${faker.string.numeric(12)}:function:${faker.lorem.word()}`
  )
  .attr('memoryLimitInMB', '512')
  .attr('awsRequestId', () => faker.string.uuid())
  .attr('logGroupName', () => `/aws/lambda/${faker.lorem.word()}`)
  .attr(
    'logStreamName',
    () =>
      `${faker.date.recent().toISOString().split('T')[0]}/[$LATEST]${faker.string.alphanumeric(32)}`
  )
  .attr('getRemainingTimeInMillis', () => () => 30000)
  .attr('done', () => () => {})
  .attr('fail', () => () => {})
  .attr('succeed', () => () => {});
