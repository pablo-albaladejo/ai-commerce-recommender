# Request Tracing Guidelines

## Always Implement Request Tracing

- **All Lambda functions must implement comprehensive request tracing**
- Every log entry must contain trace metadata that relates all logs for a request
- Trace context must be propagated across all components and service calls
- This enables complete request visibility and debugging capabilities

## Trace Context Structure

### Required Trace Context Fields

```typescript
type TraceContext = {
  traceId: string; // Unique identifier for the entire request (UUID)
  requestId: string; // AWS Lambda request ID
  userId?: number; // User identifier (when available)
  chatId?: number; // Chat/session identifier (when available)
  timestamp: string; // ISO timestamp of request start
  correlationId?: string; // For correlating with external systems
  sessionId?: string; // User session identifier
  parentSpanId?: string; // For nested operations (UUID)
  spanId: string; // Current operation identifier (UUID)
};
```

### Structured Log Entry Format

```typescript
type LogEntry = {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  trace: TraceContext; // REQUIRED - trace context for correlation
  component: string; // Component name (e.g., 'telegram-webhook', 'chat-api')
  operation: string; // Operation name (e.g., 'validate-signature', 'process-message')
  duration?: number; // Operation duration in milliseconds
  metadata?: Record<string, any>; // Additional context-specific data
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};
```

## Implementation Patterns

### Tracing Middleware for Lambda Functions

Always implement tracing as the first middleware in the Middy stack:

```typescript
import { v4 as uuidv4 } from "uuid";
import middy from "@middy/core";

const tracingMiddleware = (): middy.MiddlewareObj => ({
  before: async (request) => {
    const traceId = uuidv4();
    const spanId = uuidv4();
    const timestamp = new Date().toISOString();

    const traceContext: TraceContext = {
      traceId,
      requestId: request.context.awsRequestId,
      timestamp,
      spanId,
    };

    // Store trace context in request for use throughout the handler
    request.context.trace = traceContext;

    // Log request start
    logger.info("Request started", {
      trace: traceContext,
      component: "my-component",
      operation: "handle-request",
      metadata: {
        method: request.event.httpMethod,
        path: request.event.path,
      },
    });
  },

  after: async (request) => {
    const duration =
      Date.now() - new Date(request.context.trace.timestamp).getTime();

    logger.info("Request completed", {
      trace: request.context.trace,
      component: "my-component",
      operation: "handle-request",
      duration,
      metadata: {
        statusCode: request.response?.statusCode,
      },
    });
  },

  onError: async (request) => {
    const duration =
      Date.now() - new Date(request.context.trace.timestamp).getTime();

    logger.error("Request failed", {
      trace: request.context.trace,
      component: "my-component",
      operation: "handle-request",
      duration,
      error: {
        name: request.error?.name || "UnknownError",
        message: request.error?.message || "Unknown error occurred",
        stack: request.error?.stack,
      },
    });
  },
});

// Always use tracing middleware first
export const handler = middy(myHandler)
  .use(tracingMiddleware()) // MUST be first
  .use(jsonBodyParser())
  .use(validator({ eventSchema: schema }))
  .use(httpErrorHandler());
```

### Structured Logger Implementation

Create a centralized logger that enforces structured logging:

```typescript
// packages/core/src/lib/logger.ts
class StructuredLogger {
  private logLevel: string;

  constructor() {
    this.logLevel = process.env.LOG_LEVEL || "info";
  }

  private shouldLog(level: string): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatLog(entry: LogEntry): string {
    return JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
  }

  info(message: string, context: Partial<LogEntry> = {}) {
    if (!this.shouldLog("info")) return;

    const entry: LogEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      trace: context.trace!,
      component: context.component || "unknown",
      operation: context.operation || "unknown",
      ...context,
    };

    console.log(this.formatLog(entry));
  }

  error(message: string, context: Partial<LogEntry> = {}) {
    const entry: LogEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      trace: context.trace!,
      component: context.component || "unknown",
      operation: context.operation || "unknown",
      ...context,
    };

    console.error(this.formatLog(entry));
  }

  // ... other log levels
}

export const logger = new StructuredLogger();
```

### Trace Context Propagation

Always propagate trace context to downstream operations:

```typescript
// Creating child spans for nested operations
const processSubOperation = async (data: any, parentTrace: TraceContext) => {
  const spanId = uuidv4();
  const operationTrace = {
    ...parentTrace,
    spanId,
    parentSpanId: parentTrace.spanId,
  };

  logger.info("Starting sub-operation", {
    trace: operationTrace,
    component: "my-component",
    operation: "sub-operation",
  });

  try {
    // Perform operation
    const result = await someAsyncOperation(data);

    logger.info("Sub-operation completed", {
      trace: operationTrace,
      component: "my-component",
      operation: "sub-operation",
      metadata: { resultSize: result.length },
    });

    return result;
  } catch (error) {
    logger.error("Sub-operation failed", {
      trace: operationTrace,
      component: "my-component",
      operation: "sub-operation",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
    throw error;
  }
};
```

### External Service Calls with Tracing

Include trace context in external service calls:

```typescript
const callExternalService = async (data: any, trace: TraceContext) => {
  const spanId = uuidv4();
  const serviceTrace = { ...trace, spanId, parentSpanId: trace.spanId };

  logger.info("Calling external service", {
    trace: serviceTrace,
    component: "external-client",
    operation: "api-call",
    metadata: {
      endpoint: "https://api.example.com/data",
      method: "POST",
    },
  });

  try {
    const response = await fetch("https://api.example.com/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trace-Id": trace.traceId, // Pass trace ID to external service
        "X-Correlation-Id": trace.correlationId || trace.traceId,
      },
      body: JSON.stringify(data),
    });

    logger.info("External service call completed", {
      trace: serviceTrace,
      component: "external-client",
      operation: "api-call",
      metadata: {
        statusCode: response.status,
        responseSize: response.headers.get("content-length"),
      },
    });

    return await response.json();
  } catch (error) {
    logger.error("External service call failed", {
      trace: serviceTrace,
      component: "external-client",
      operation: "api-call",
      error: {
        name: error.name,
        message: error.message,
      },
    });
    throw error;
  }
};
```

## Error Handling with Tracing

### Custom Error Classes with Trace Context

```typescript
class TracedError extends Error {
  constructor(
    message: string,
    public traceContext: TraceContext,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends TracedError {
  constructor(message: string, traceContext: TraceContext) {
    super(message, traceContext, 400);
  }
}

// Usage in middleware
const validationMiddleware = (): middy.MiddlewareObj => ({
  before: async (request) => {
    const trace = request.context.trace;

    try {
      // Validation logic
      validateRequest(request.event.body);
    } catch (error) {
      logger.error("Validation failed", {
        trace,
        component: "validation",
        operation: "validate-request",
        error: {
          name: error.name,
          message: error.message,
        },
      });

      throw new ValidationError("Request validation failed", trace);
    }
  },
});
```

### Error Response with Trace ID

Always include trace ID in error responses:

```typescript
const errorHandler = (): middy.MiddlewareObj => ({
  onError: async (request) => {
    const trace = request.context.trace;

    request.response = {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        error: "Request failed",
        message: error.message,
        traceId: trace.traceId, // Include for debugging
      }),
      headers: {
        "X-Trace-Id": trace.traceId,
      },
    };
  },
});
```

## Testing Tracing Implementation

### Unit Tests for Tracing

```typescript
describe("Request Tracing", () => {
  test("generates unique trace ID for each request", async () => {
    const event1 = { body: "{}" };
    const event2 = { body: "{}" };

    const result1 = await handler(event1, {} as any);
    const result2 = await handler(event2, {} as any);

    expect(result1.headers["X-Trace-Id"]).toBeDefined();
    expect(result2.headers["X-Trace-Id"]).toBeDefined();
    expect(result1.headers["X-Trace-Id"]).not.toBe(
      result2.headers["X-Trace-Id"]
    );
  });

  test("propagates trace context through operations", async () => {
    const consoleSpy = jest.spyOn(console, "log");

    await handler({ body: "{}" }, {} as any);

    const logEntries = consoleSpy.mock.calls.map((call) => JSON.parse(call[0]));
    const traceIds = logEntries
      .map((entry) => entry.trace?.traceId)
      .filter(Boolean);

    // All log entries should have the same trace ID
    expect(new Set(traceIds).size).toBe(1);

    consoleSpy.mockRestore();
  });
});
```

## Log Aggregation and Querying

### CloudWatch Logs Integration

- All structured logs automatically sent to CloudWatch Logs
- Log groups organized by Lambda function name
- Use trace IDs for cross-service correlation

### Common Log Queries

```bash
# Find all logs for a specific trace
aws logs filter-log-events \
  --log-group-name "/aws/lambda/my-function" \
  --filter-pattern "{ $.trace.traceId = \"trace-id-here\" }"

# Find all errors for a specific user
aws logs filter-log-events \
  --log-group-name "/aws/lambda/my-function" \
  --filter-pattern "{ $.level = \"error\" && $.trace.userId = 123456 }"

# Find slow operations (> 5 seconds)
aws logs filter-log-events \
  --log-group-name "/aws/lambda/my-function" \
  --filter-pattern "{ $.duration > 5000 }"

# Find all operations for a component
aws logs filter-log-events \
  --log-group-name "/aws/lambda/my-function" \
  --filter-pattern "{ $.component = \"telegram-webhook\" }"
```

### CloudWatch Insights Queries

```sql
-- Find request flow for a specific trace
fields @timestamp, component, operation, message, duration
| filter trace.traceId = "trace-id-here"
| sort @timestamp asc

-- Find error patterns
fields @timestamp, component, operation, error.name, error.message
| filter level = "error"
| stats count() by error.name
| sort count desc

-- Performance analysis
fields @timestamp, component, operation, duration
| filter duration > 1000
| stats avg(duration), max(duration), count() by component, operation
```

## Environment Configuration

### Required Environment Variables

```typescript
const TracingEnvSchema = z.object({
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENABLE_TRACING: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  TRACE_SAMPLE_RATE: z.string().transform(Number).default("1.0"), // 0.0 to 1.0
});
```

### Performance Considerations

- Structured logging adds minimal overhead (~1-2ms per log entry)
- Trace context propagation is lightweight (small object passed by reference)
- UUID generation is fast and collision-resistant
- Log level filtering reduces noise in production
- Consider sampling for high-volume applications

## Dependencies

Required packages for tracing implementation:

```json
{
  "dependencies": {
    "uuid": "^9.0.0",
    "@types/uuid": "^9.0.0"
  }
}
```

This ensures complete request traceability across all components while maintaining performance and providing rich debugging capabilities through structured, correlated logging.
