# Middy Middleware Guidelines

## Always Use Middy for Lambda Functions

- **All Lambda functions must use Middy middleware framework**
- Middy provides clean separation of concerns for cross-cutting functionality
- Use Middy for validation, error handling, authentication, and other middleware concerns
- This ensures consistent behavior across all Lambda functions

## Core Middy Middleware Stack

### Standard Middleware Stack

Every Lambda function should include this basic middleware stack:

```typescript
import middy from "@middy/core";
import jsonBodyParser from "@middy/http-json-body-parser";
import httpErrorHandler from "@middy/http-error-handler";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";

// Core handler function (business logic only)
const myHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handler logic here - data is already validated by Middy
  const validatedData = event.body; // Type-safe after validation

  // Business logic
  const result = await processData(validatedData);

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
};

// Middy wrapper with middleware stack
export const handler = middy(myHandler)
  .use(jsonBodyParser()) // Parse JSON body
  .use(
    validator({
      eventSchema: transpileSchema(MyRequestSchema), // Zod schema validation
    })
  )
  .use(httpErrorHandler()); // Handle errors gracefully
```

### Required Middleware

1. **JSON Body Parser** - Always parse JSON bodies
2. **Validator** - Always validate input with Zod schemas
3. **HTTP Error Handler** - Always handle errors gracefully

### Optional Middleware (use as needed)

- **CORS** - For browser requests
- **HTTP Security Headers** - For security
- **Rate Limiter** - For API protection
- **Authentication** - For protected endpoints

## Zod Integration with Middy

### Schema Validation

Always use Zod schemas with Middy validator:

```typescript
import { z } from "zod";
import { transpileSchema } from "@middy/validator/transpile";

// Define Zod schema
const CreateUserRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});

// Use with Middy validator
export const handler = middy(createUserHandler).use(
  validator({
    eventSchema: transpileSchema(CreateUserRequestSchema),
  })
);
```

### Environment Variable Validation

Validate environment variables using custom middleware:

```typescript
const envValidator = (): middy.MiddlewareObj => ({
  before: async (request) => {
    if (!request.context.env) {
      const EnvSchema = z.object({
        DATABASE_URL: z.string().url(),
        API_KEY: z.string().min(1),
        LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
      });

      request.context.env = EnvSchema.parse(process.env);
    }
  },
});

export const handler = middy(myHandler)
  .use(envValidator())
  .use(jsonBodyParser())
  .use(httpErrorHandler());
```

## Custom Middleware

### Creating Custom Middleware

Follow this pattern for custom middleware:

```typescript
type MyMiddlewareOptions = {
  option1: string;
  option2?: number;
};

const myCustomMiddleware = (
  options: MyMiddlewareOptions
): middy.MiddlewareObj => ({
  before: async (request) => {
    // Pre-processing logic
    console.log("Before handler execution");

    // Modify request if needed
    request.event.customData = options.option1;
  },

  after: async (request) => {
    // Post-processing logic
    console.log("After handler execution");

    // Modify response if needed
    if (request.response) {
      request.response.headers = {
        ...request.response.headers,
        "X-Custom-Header": "value",
      };
    }
  },

  onError: async (request) => {
    // Error handling logic
    console.error("Error in handler:", request.error);

    // Optionally modify error response
    if (request.error?.name === "CustomError") {
      request.response = {
        statusCode: 400,
        body: JSON.stringify({ error: "Custom error occurred" }),
      };
    }
  },
});

// Usage
export const handler = middy(myHandler)
  .use(myCustomMiddleware({ option1: "value" }))
  .use(httpErrorHandler());
```

### Common Custom Middleware Patterns

**Authentication Middleware**:

```typescript
const authMiddleware = (): middy.MiddlewareObj => ({
  before: async (request) => {
    const token = request.event.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      throw new Error("Missing authorization token");
    }

    const user = await validateToken(token);
    request.context.user = user;
  },
});
```

**Rate Limiting Middleware**:

```typescript
const rateLimiter = (options: {
  maxRequests: number;
  windowMs: number;
}): middy.MiddlewareObj => ({
  before: async (request) => {
    const clientId = getClientId(request.event);
    const isAllowed = await checkRateLimit(clientId, options);

    if (!isAllowed) {
      throw new Error("Rate limit exceeded");
    }
  },
});
```

**Logging Middleware**:

```typescript
const requestLogger = (): middy.MiddlewareObj => ({
  before: async (request) => {
    console.log("Request:", {
      method: request.event.httpMethod,
      path: request.event.path,
      timestamp: new Date().toISOString(),
    });
  },

  after: async (request) => {
    console.log("Response:", {
      statusCode: request.response?.statusCode,
      timestamp: new Date().toISOString(),
    });
  },
});
```

## Error Handling

### Structured Error Handling

Use custom error classes with Middy error handler:

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

class AuthenticationError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = 401;
  }
}

// Custom error handler middleware
const customErrorHandler = (): middy.MiddlewareObj => ({
  onError: async (request) => {
    const { error } = request;

    if (error instanceof ValidationError) {
      request.response = {
        statusCode: error.statusCode,
        body: JSON.stringify({
          error: "Validation failed",
          message: error.message,
        }),
      };
      return;
    }

    if (error instanceof AuthenticationError) {
      request.response = {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
      return;
    }

    // Let default error handler manage other errors
  },
});

export const handler = middy(myHandler)
  .use(jsonBodyParser())
  .use(customErrorHandler())
  .use(httpErrorHandler()); // Always use as last error handler
```

## Testing Middy Handlers

### Unit Testing Middleware

Test middleware functions in isolation:

```typescript
import { myCustomMiddleware } from "../middleware/custom";

describe("Custom Middleware", () => {
  test("processes request correctly", async () => {
    const middleware = myCustomMiddleware({ option1: "test" });
    const mockRequest = {
      event: { body: "{}" },
      context: {},
      response: undefined,
      error: undefined,
    };

    await middleware.before!(mockRequest);

    expect(mockRequest.event.customData).toBe("test");
  });
});
```

### Integration Testing with Middy

Test complete handler with middleware stack:

```typescript
import { handler } from "../my-handler";

describe("My Handler with Middy", () => {
  test("processes valid request", async () => {
    const event = {
      body: JSON.stringify({ name: "John", email: "john@example.com" }),
      headers: { "content-type": "application/json" },
    };

    const result = await handler(event, {} as any);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  test("handles validation errors", async () => {
    const event = {
      body: JSON.stringify({ name: "", email: "invalid-email" }),
      headers: { "content-type": "application/json" },
    };

    const result = await handler(event, {} as any);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });
});
```

## Performance Considerations

### Middleware Order

Order middleware for optimal performance:

1. **Fast validation** (auth, rate limiting) first
2. **Body parsing** after validation
3. **Schema validation** after parsing
4. **Business logic middleware** last
5. **Error handlers** at the end

```typescript
export const handler = middy(myHandler)
  .use(authMiddleware()) // Fast auth check first
  .use(rateLimiter()) // Rate limiting early
  .use(jsonBodyParser()) // Parse body
  .use(validator({ eventSchema: schema })) // Validate parsed data
  .use(businessLogicMiddleware()) // Business-specific middleware
  .use(customErrorHandler()) // Custom error handling
  .use(httpErrorHandler()); // Default error handling last
```

### Caching in Middleware

Cache expensive operations in middleware:

```typescript
const configCache = new Map();

const configMiddleware = (): middy.MiddlewareObj => ({
  before: async (request) => {
    if (!configCache.has("config")) {
      const config = await loadExpensiveConfig();
      configCache.set("config", config);
    }

    request.context.config = configCache.get("config");
  },
});
```

## Dependencies

Required Middy packages:

```json
{
  "dependencies": {
    "@middy/core": "^5.0.0",
    "@middy/http-json-body-parser": "^5.0.0",
    "@middy/http-error-handler": "^5.0.0",
    "@middy/validator": "^5.0.0",
    "@middy/http-cors": "^5.0.0",
    "@middy/http-security-headers": "^5.0.0"
  }
}
```

This ensures all Lambda functions follow consistent patterns for middleware, validation, and error handling while maintaining clean separation of concerns.
