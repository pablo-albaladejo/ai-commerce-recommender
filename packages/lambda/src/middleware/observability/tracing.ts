import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import middy from '@middy/core';
import type { Subsegment } from 'aws-xray-sdk-core';
import { v4 as uuidv4 } from 'uuid';
import type {
  ExtendedLambdaContext,
  TraceContext,
} from '../types/lambda-context';

/**
 * Options for the tracing middleware
 */
type TracingMiddlewareOptions = {
  logger?: Logger;
  tracer?: Tracer;
  metrics?: Metrics;
  component: string;
};

/**
 * Extended request with subsegment storage
 */
type RequestWithSubsegment = middy.Request & {
  subsegment?: Subsegment;
};

/**
 * Error with optional statusCode
 */
type ErrorWithStatusCode = Error & {
  statusCode?: number;
};

/**
 * Parameters for subsegment annotations
 */
type SubsegmentAnnotationParams = {
  subsegment: Subsegment;
  traceId: string;
  component: string;
  requestId: string;
};

/**
 * Parameters for logging request success
 */
type LogSuccessParams = {
  options: TracingMiddlewareOptions;
  trace: TraceContext;
  duration: number;
  response?: { statusCode?: number; body?: string };
};

/**
 * Parameters for logging request error
 */
type LogErrorParams = {
  options: TracingMiddlewareOptions;
  trace: TraceContext;
  duration: number;
  error: Error | null;
};

/**
 * Parameters for recording error metrics
 */
type RecordErrorMetricsParams = {
  options: TracingMiddlewareOptions;
  duration: number;
  error: Error | null;
};

/**
 * Parameters for closing subsegment on error
 */
type CloseSubsegmentErrorParams = {
  subsegment: Subsegment | undefined;
  duration: number;
  error: Error | null;
};

/**
 * Creates trace context and X-Ray subsegment at request start
 */
const handleBefore = (
  request: middy.Request,
  options: TracingMiddlewareOptions
): void => {
  const traceId = uuidv4();
  const spanId = uuidv4();
  const timestamp = new Date().toISOString();

  const traceContext: TraceContext = {
    traceId,
    requestId: request.context.awsRequestId,
    timestamp,
    spanId,
  };

  // Extend Lambda context with trace information
  const extendedContext = request.context as unknown as ExtendedLambdaContext;
  extendedContext.trace = traceContext;

  // Create X-Ray subsegment if tracer is available
  const subsegment = options.tracer
    ?.getSegment()
    ?.addNewSubsegment('request-processing');

  if (subsegment) {
    addSubsegmentAnnotations({
      subsegment,
      traceId,
      component: options.component,
      requestId: request.context.awsRequestId,
    });
  }

  logRequestStart(options, traceId, request);
  recordRequestReceivedMetrics(options, traceId);

  // Store subsegment for cleanup in after/onError
  if (subsegment) {
    (request as RequestWithSubsegment).subsegment = subsegment;
  }
};

/**
 * Adds annotations to X-Ray subsegment
 */
const addSubsegmentAnnotations = (params: SubsegmentAnnotationParams): void => {
  const { subsegment, traceId, component, requestId } = params;
  subsegment.addAnnotation('traceId', traceId);
  subsegment.addAnnotation('component', component);
  subsegment.addAnnotation('requestId', requestId);
};

/**
 * Logs the request start with structured context
 */
const logRequestStart = (
  options: TracingMiddlewareOptions,
  traceId: string,
  request: middy.Request
): void => {
  options.logger?.info('Request started', {
    operation: 'handle-request',
    traceId,
    requestId: request.context.awsRequestId,
    component: options.component,
    metadata: {
      functionName: request.context.functionName,
      functionVersion: request.context.functionVersion,
      memoryLimitInMB: request.context.memoryLimitInMB,
      remainingTimeInMillis: request.context.getRemainingTimeInMillis(),
    },
  });
};

/**
 * Records request received metrics
 */
const recordRequestReceivedMetrics = (
  options: TracingMiddlewareOptions,
  traceId: string
): void => {
  options.metrics?.addMetric('RequestReceived', MetricUnit.Count, 1);
  options.metrics?.addMetadata('traceId', traceId);
  options.metrics?.addMetadata('component', options.component);
};

/**
 * Handles successful request completion
 */
const handleAfter = (
  request: middy.Request,
  options: TracingMiddlewareOptions
): void => {
  const extendedContext = request.context as unknown as ExtendedLambdaContext;
  const trace = extendedContext.trace;
  const subsegment = (request as RequestWithSubsegment).subsegment;

  if (!trace) return;

  const duration = calculateDuration(trace.timestamp);

  logRequestSuccess({
    options,
    trace,
    duration,
    response: request.response,
  });
  recordSuccessMetrics(options, duration);
  closeSubsegmentSuccess(subsegment, duration);
};

/**
 * Calculates duration from timestamp
 */
const calculateDuration = (timestamp: string): number => {
  return Date.now() - new Date(timestamp).getTime();
};

/**
 * Logs successful request completion
 */
const logRequestSuccess = (params: LogSuccessParams): void => {
  const { options, trace, duration, response } = params;
  options.logger?.info('Request completed successfully', {
    operation: 'handle-request',
    traceId: trace.traceId,
    requestId: trace.requestId,
    component: options.component,
    duration,
    metadata: {
      statusCode: response?.statusCode,
      responseSize: response?.body?.length,
    },
  });
};

/**
 * Records success metrics
 */
const recordSuccessMetrics = (
  options: TracingMiddlewareOptions,
  duration: number
): void => {
  options.metrics?.addMetric('RequestSuccess', MetricUnit.Count, 1);
  options.metrics?.addMetric(
    'RequestDuration',
    MetricUnit.Milliseconds,
    duration
  );
};

/**
 * Closes X-Ray subsegment on success
 */
const closeSubsegmentSuccess = (
  subsegment: Subsegment | undefined,
  duration: number
): void => {
  if (subsegment) {
    subsegment.addAnnotation('success', true);
    subsegment.addAnnotation('duration', duration);
    subsegment.close();
  }
};

/**
 * Handles request errors
 */
const handleError = (
  request: middy.Request,
  options: TracingMiddlewareOptions
): void => {
  const extendedContext = request.context as unknown as ExtendedLambdaContext;
  const trace = extendedContext.trace;
  const subsegment = (request as RequestWithSubsegment).subsegment;
  const error = request.error;

  if (!trace) return;

  const duration = calculateDuration(trace.timestamp);

  logRequestError({ options, trace, duration, error });
  recordErrorMetrics({ options, duration, error });
  closeSubsegmentError({ subsegment, duration, error });
};

/**
 * Logs request error with full context
 */
const logRequestError = (params: LogErrorParams): void => {
  const { options, trace, duration, error } = params;
  const errorWithStatus = error as ErrorWithStatusCode | null;

  options.logger?.error('Request failed', {
    operation: 'handle-request',
    traceId: trace.traceId,
    requestId: trace.requestId,
    component: options.component,
    duration,
    error: {
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error occurred',
      stack: error?.stack,
      statusCode: errorWithStatus?.statusCode,
    },
  });
};

/**
 * Records error metrics
 */
const recordErrorMetrics = (params: RecordErrorMetricsParams): void => {
  const { options, duration, error } = params;
  options.metrics?.addMetric('RequestError', MetricUnit.Count, 1);
  options.metrics?.addMetric(
    'RequestDuration',
    MetricUnit.Milliseconds,
    duration
  );
  options.metrics?.addDimensions({
    errorType: error?.constructor.name || 'UnknownError',
  });
};

/**
 * Closes X-Ray subsegment on error
 */
const closeSubsegmentError = (params: CloseSubsegmentErrorParams): void => {
  const { subsegment, duration, error } = params;
  if (subsegment) {
    subsegment.addAnnotation('success', false);
    subsegment.addAnnotation('error', error?.message || 'Unknown error');
    subsegment.addAnnotation('duration', duration);
    subsegment.close(error ?? undefined);
  }
};

/**
 * Tracing middleware that creates trace context and injects it into Lambda context
 * Provides comprehensive request tracing with Powertools integration
 */
export const tracingMiddleware = (
  options: TracingMiddlewareOptions
): middy.MiddlewareObj => ({
  before: async request => handleBefore(request, options),
  after: async request => handleAfter(request, options),
  onError: async request => handleError(request, options),
});
