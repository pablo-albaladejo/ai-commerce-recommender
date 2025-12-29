import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

type StatusCode = NonNullable<APIGatewayProxyStructuredResultV2['statusCode']>;
type HttpResponse = {
  body: string;
  headers: NonNullable<APIGatewayProxyStructuredResultV2['headers']>;
  statusCode: StatusCode;
};

export const httpResponse = (
  httpCode: StatusCode,
  bodyResponse: Record<PropertyKey, unknown> = {}
): HttpResponse => ({
  body: JSON.stringify(bodyResponse),
  headers: { 'Content-Type': 'application/json' },
  statusCode: httpCode,
});
