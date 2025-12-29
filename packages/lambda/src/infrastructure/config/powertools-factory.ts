import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Powertools configuration options
 */
export type PowertoolsConfig = {
  serviceName: string;
  logLevel?: LogLevel;
  environment?: string;
  version?: string;
  namespace?: string;
  captureHTTPsRequests?: boolean;
};

/**
 * Powertools instances container
 */
export type PowertoolsInstances = {
  logger: Logger;
  tracer: Tracer;
  metrics: Metrics;
};

/**
 * Factory function to create standardized Powertools instances
 */
export const createPowertools = (
  config: PowertoolsConfig
): PowertoolsInstances => {
  const {
    serviceName,
    logLevel = (process.env.LOG_LEVEL as LogLevel) || 'INFO',
    environment = process.env.ENVIRONMENT || 'dev',
    version = process.env.SERVICE_VERSION || '1.0.0',
    namespace = 'AICommerce',
    captureHTTPsRequests = true,
  } = config;

  const logger = new Logger({
    serviceName,
    logLevel,
    persistentLogAttributes: { version, environment },
  });

  const tracer = new Tracer({
    serviceName,
    captureHTTPsRequests,
  });

  const metrics = new Metrics({
    namespace,
    serviceName,
    defaultDimensions: { environment, version },
  });

  return { logger, tracer, metrics };
};

/**
 * Default Powertools instances for the Lambda package
 */
export const defaultPowertools = createPowertools({
  serviceName: 'ai-commerce-lambda',
});

export const { logger, tracer, metrics } = defaultPowertools;
