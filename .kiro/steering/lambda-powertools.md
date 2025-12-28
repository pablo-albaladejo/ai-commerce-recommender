# AWS Lambda Powertools Guidelines

## Always Use AWS Lambda Powertools for Observability

- **All Lambda functions must use AWS Lambda Powertools for logging, tracing, and metrics**
- Powertools provides enterprise-grade observability with minimal configuration
- Integrates seamlessly with AWS services (CloudWatch, X-Ray, CloudWatch Metrics)
- Provides structured logging, distributed tracing, and custom metrics out of the box

## Core Powertools Components

### Logger

- **Structured JSON logging** with automatic correlation IDs
- **Configurable log levels** and sampling rates
- **Automatic request context** injection
- **Cold start detection** and logging

### Tracer

- **Automatic X-Ray integration** for distributed tracing
- **HTTP request/response capture** for external calls
- **Custom subsegments** for business logic tracing
- **Error capture** and annotation

### Metrics

- **Custom business metrics** with dimensions
- **Automatic CloudWatch integration**
- **Cold start metrics** and performance tracking
- **Metadata support** for additional context

## Standard Implementation Pattern

### Basic Setup

```typescript
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import middy from "@middy/core";

// Initialize Powertools (do this once per file)
const logger = new Logger({
  serviceName: "my-service",
  logLevel: process.env.LOG_LEVEL || "INFO",
  persistentLogAttributes: {
    version: process.env.SERVICE_VERSION || "1.0.0",
    environment: process.env.ENVIRONMENT || "dev",
  },
});

const tracer = new Tracer({
  serviceName: "my-service",
  captureHTTPsRequests: true,
  captureResponse: true,
});

const metrics = new Metrics({
  namespace: "MyApplication",
  serviceName: "my-service",
  defaultDimensions: {
    environment: process.env.ENVIRONMENT || "dev",
    version: process.env.SERVICE_VERSION || "1.0.0",
  },
});
```

### Lambda Handler with Powertools and Middy

```typescript
const myHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Create custom subsegment for business logic
  const subsegment = tracer.getSegment()?.addNewSubsegment("business-logic");

  try {
    // Log with structured context
    logger.info("Processing request", {
      operation: "process-request",
      requestId: event.requestContext.requestId,
    });

    // Add annotations to trace
    subsegment?.addAnnotation("userId", event.pathParameters?.userId);
    subsegment?.addAnnotation("operation", "process-request");

    // Record custom metrics
    metrics.addMetric("RequestReceived", MetricUnits.Count, 1);
    metrics.addMetadata("requestId", event.requestContext.requestId);

    // Business logic here
    const result = await processBusinessLogic(event.body);

    // Record success metrics
    metrics.addMetric("RequestProcessedSuccessfully", MetricUnits.Count, 1);

    logger.info("Request processed successfully", {
      operation: "process-request",
      resultSize: result.length,
    });

    subsegment?.addAnnotation("success", true);
    subsegment?.close();

    return {
      statusCode: 200,
      body: JSON.stringify(result),
      headers: {
        "X-Trace-Id": tracer.getRootXrayTraceId() || "unknown",
      },
    };
  } catch (error) {
    // Record error metrics
    metrics.addMetric("RequestProcessingFailed", MetricUnits.Count, 1);

    logger.error("Request processing failed", {
      operation: "process-request",
      error: error.message,
      stack: error.stack,
    });

    subsegment?.addAnnotation("success", false);
    subsegment?.addAnnotation("error", error.message);
    subsegment?.close(error);

    throw error;
  }
};

// Middy wrapper with Powertools middleware (ORDER MATTERS)
export const handler = middy(myHandler)
  .use(injectLambdaContext(logger, { logEvent: true })) // Logger context - FIRST
  .use(captureLambdaHandler(tracer)) // X-Ray tracing - SECOND
  .use(logMetrics(metrics, { captureColdStartMetric: true })) // Metrics - THIRD
  .use(jsonBodyParser()) // Other middleware after Powertools
  .use(validator({ eventSchema: schema }))
  .use(httpErrorHandler());
```

## Logging Best Practices

### Structured Logging

```typescript
// ✅ Good - Structured logging with context
logger.info("User action completed", {
  operation: "user-action",
  userId: user.id,
  action: "purchase",
  amount: order.total,
  duration: Date.now() - startTime,
});

// ❌ Bad - Unstructured logging
logger.info(`User ${user.id} completed purchase of $${order.total}`);
```

### Log Levels

```typescript
// DEBUG - Detailed information for debugging
logger.debug("Validating request payload", {
  operation: "validate-request",
  payloadSize: payload.length,
});

// INFO - General information about application flow
logger.info("Processing user request", {
  operation: "process-request",
  userId: user.id,
});

// WARN - Warning conditions that should be monitored
logger.warn("Rate limit approaching", {
  operation: "rate-limit-check",
  userId: user.id,
  currentCount: count,
  limit: maxLimit,
});

// ERROR - Error conditions that need attention
logger.error("External service call failed", {
  operation: "external-api-call",
  service: "payment-gateway",
  error: error.message,
  stack: error.stack,
});
```

### Dynamic Log Attributes

```typescript
// Add persistent attributes for the entire request
logger.appendKeys({
  userId: user.id,
  sessionId: session.id,
  correlationId: event.headers["x-correlation-id"],
});

// Now all subsequent logs will include these attributes
logger.info("Starting payment process"); // Will include userId, sessionId, correlationId
logger.info("Payment completed"); // Will include userId, sessionId, correlationId
```

## Tracing Best Practices

### Custom Subsegments

```typescript
const processPayment = async (paymentData: PaymentData) => {
  const subsegment = tracer.getSegment()?.addNewSubsegment("process-payment");

  try {
    // Add annotations for filtering in X-Ray console
    subsegment?.addAnnotation("paymentMethod", paymentData.method);
    subsegment?.addAnnotation("amount", paymentData.amount);
    subsegment?.addAnnotation("currency", paymentData.currency);

    // Add metadata for additional context (not indexed)
    subsegment?.addMetadata("paymentDetails", {
      merchantId: paymentData.merchantId,
      customerEmail: paymentData.customerEmail,
    });

    const result = await paymentGateway.charge(paymentData);

    subsegment?.addAnnotation("success", true);
    subsegment?.addAnnotation("transactionId", result.transactionId);
    subsegment?.close();

    return result;
  } catch (error) {
    subsegment?.addAnnotation("success", false);
    subsegment?.addAnnotation("error", error.message);
    subsegment?.close(error);
    throw error;
  }
};
```

### Tracing External Calls

```typescript
// Powertools automatically traces HTTP calls when captureHTTPsRequests: true
const callExternalAPI = async (data: any) => {
  // This will be automatically traced by Powertools
  const response = await fetch("https://api.example.com/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Trace-Id": tracer.getRootXrayTraceId(), // Pass trace ID
    },
    body: JSON.stringify(data),
  });

  return response.json();
};

// For manual tracing of non-HTTP operations
const processData = async (data: any) => {
  const subsegment = tracer.getSegment()?.addNewSubsegment("data-processing");

  try {
    subsegment?.addAnnotation("dataSize", data.length);

    const result = await heavyDataProcessing(data);

    subsegment?.addAnnotation("resultSize", result.length);
    subsegment?.close();

    return result;
  } catch (error) {
    subsegment?.close(error);
    throw error;
  }
};
```

## Metrics Best Practices

### Business Metrics

```typescript
// Record business events
metrics.addMetric("OrderPlaced", MetricUnits.Count, 1);
metrics.addMetric("OrderValue", MetricUnits.None, order.total);
metrics.addMetric("ProcessingTime", MetricUnits.Milliseconds, duration);

// Add dimensions for filtering
metrics.addDimensions({
  paymentMethod: order.paymentMethod,
  customerTier: customer.tier,
  region: customer.region,
});

// Add metadata for additional context (not used for metrics)
metrics.addMetadata("orderId", order.id);
metrics.addMetadata("customerEmail", customer.email);
```

### Performance Metrics

```typescript
const startTime = Date.now();

try {
  const result = await processRequest(data);

  // Record success metrics
  metrics.addMetric("RequestSuccess", MetricUnits.Count, 1);
  metrics.addMetric(
    "RequestDuration",
    MetricUnits.Milliseconds,
    Date.now() - startTime
  );

  return result;
} catch (error) {
  // Record error metrics
  metrics.addMetric("RequestError", MetricUnits.Count, 1);
  metrics.addMetric(
    "RequestDuration",
    MetricUnits.Milliseconds,
    Date.now() - startTime
  );

  // Add error type dimension
  metrics.addDimensions({
    errorType: error.constructor.name,
  });

  throw error;
}
```

### Custom Metric Units

```typescript
// Use appropriate metric units
metrics.addMetric("DatabaseConnections", MetricUnits.Count, connectionCount);
metrics.addMetric("ResponseTime", MetricUnits.Milliseconds, responseTime);
metrics.addMetric("DataTransferred", MetricUnits.Bytes, dataSize);
metrics.addMetric("CPUUtilization", MetricUnits.Percent, cpuUsage);
metrics.addMetric("MemoryUsage", MetricUnits.Megabytes, memoryUsage);
metrics.addMetric(
  "ThroughputPerSecond",
  MetricUnits.CountPerSecond,
  throughput
);
```

## Environment Configuration

### Required Environment Variables

```typescript
// Powertools configuration
POWERTOOLS_SERVICE_NAME=my-service
POWERTOOLS_METRICS_NAMESPACE=MyApplication
POWERTOOLS_LOGGER_LOG_EVENT=false
POWERTOOLS_LOGGER_SAMPLE_RATE=0.1
POWERTOOLS_TRACE_DISABLED=false
POWERTOOLS_TRACER_CAPTURE_RESPONSE=true
POWERTOOLS_TRACER_CAPTURE_ERROR=true
POWERTOOLS_METRICS_CAPTURE_COLD_START_METRIC=true

// Application configuration
LOG_LEVEL=INFO
SERVICE_VERSION=1.0.0
ENVIRONMENT=production
```

### CDK Infrastructure Configuration

```typescript
import { Tracing } from "aws-cdk-lib/aws-lambda";

const myFunction = new Function(this, "MyFunction", {
  runtime: Runtime.NODEJS_18_X,
  handler: "index.handler",
  code: Code.fromAsset("dist"),
  environment: {
    // Powertools environment variables
    POWERTOOLS_SERVICE_NAME: "my-service",
    POWERTOOLS_METRICS_NAMESPACE: "MyApplication",
    POWERTOOLS_LOGGER_LOG_EVENT: "false",
    POWERTOOLS_LOGGER_SAMPLE_RATE: "0.1",
    POWERTOOLS_TRACE_DISABLED: "false",
    POWERTOOLS_TRACER_CAPTURE_RESPONSE: "true",
    POWERTOOLS_TRACER_CAPTURE_ERROR: "true",
    POWERTOOLS_METRICS_CAPTURE_COLD_START_METRIC: "true",

    // Application environment variables
    LOG_LEVEL: "INFO",
    SERVICE_VERSION: "1.0.0",
    ENVIRONMENT: "production",
  },
  tracing: Tracing.ACTIVE, // Enable X-Ray tracing
  timeout: Duration.seconds(30),
  memorySize: 512,
});

// Grant necessary permissions for Powertools
myFunction.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ],
    resources: ["*"],
  })
);
```

## Testing with Powertools

### Unit Testing

```typescript
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Metrics } from "@aws-lambda-powertools/metrics";

// Mock Powertools for testing
jest.mock("@aws-lambda-powertools/logger");
jest.mock("@aws-lambda-powertools/tracer");
jest.mock("@aws-lambda-powertools/metrics");

describe("My Handler with Powertools", () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockTracer: jest.Mocked<Tracer>;
  let mockMetrics: jest.Mocked<Metrics>;

  beforeEach(() => {
    mockLogger = new Logger() as jest.Mocked<Logger>;
    mockTracer = new Tracer() as jest.Mocked<Tracer>;
    mockMetrics = new Metrics() as jest.Mocked<Metrics>;
  });

  test("logs structured entries", async () => {
    const event = { body: "{}" };

    await handler(event, {} as any);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Processing request",
      expect.objectContaining({
        operation: "process-request",
      })
    );
  });

  test("records metrics", async () => {
    const event = { body: "{}" };

    await handler(event, {} as any);

    expect(mockMetrics.addMetric).toHaveBeenCalledWith(
      "RequestReceived",
      expect.any(String),
      1
    );
  });

  test("creates trace subsegments", async () => {
    const mockSubsegment = {
      addAnnotation: jest.fn(),
      close: jest.fn(),
    };

    mockTracer.getSegment.mockReturnValue({
      addNewSubsegment: jest.fn().mockReturnValue(mockSubsegment),
    } as any);

    const event = { body: "{}" };

    await handler(event, {} as any);

    expect(mockSubsegment.addAnnotation).toHaveBeenCalledWith("success", true);
    expect(mockSubsegment.close).toHaveBeenCalled();
  });
});
```

## Dependencies

Required Powertools packages:

```json
{
  "dependencies": {
    "@aws-lambda-powertools/logger": "^2.0.0",
    "@aws-lambda-powertools/tracer": "^2.0.0",
    "@aws-lambda-powertools/metrics": "^2.0.0",
    "@aws-lambda-powertools/commons": "^2.0.0"
  }
}
```

## Benefits of Using Powertools

### Observability

- **Structured logging** with automatic correlation
- **Distributed tracing** across services
- **Custom metrics** for business insights
- **Performance monitoring** and alerting

### Developer Experience

- **Minimal configuration** required
- **Automatic instrumentation** of AWS SDK calls
- **Type-safe** TypeScript implementation
- **Consistent patterns** across all functions

### Operations

- **CloudWatch integration** out of the box
- **X-Ray service map** visualization
- **Automated dashboards** and alerts
- **Cost-effective** monitoring solution

This ensures all Lambda functions have enterprise-grade observability with minimal configuration while following AWS best practices.
