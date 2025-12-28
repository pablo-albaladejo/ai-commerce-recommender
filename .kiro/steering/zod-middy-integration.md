# Zod + Middy Integration Guidelines

## Always Use Custom Parser Middleware

- **Use custom parser middleware instead of generic validator**
- Direct Zod integration provides better type safety and error handling
- Cleaner API with no transpilation overhead
- Better performance and simpler configuration

## Custom Parser Implementation

### Recommended Pattern

```typescript
import { z } from "zod";
import middy from "@middy/core";

// Custom Zod parser middleware - cleaner than generic validator
const parser = (options: { schema: z.ZodSchema }): middy.MiddlewareObj => ({
  before: async (request) => {
    try {
      // Parse and validate the request body
      const result = options.schema.safeParse(request.event.body);

      if (!result.success) {
        throw new ValidationError(
          "Request validation failed",
          result.error.issues
        );
      }

      // Replace the raw body with the parsed and validated data
      request.event.body = result.data;
    } catch (error) {
      throw error;
    }
  },
});

// Custom validation error class
class ValidationError extends Error {
  constructor(
    message: string,
    public issues: z.ZodIssue[]
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
```

### Usage Pattern

```typescript
// Define Zod schema
const CreateUserRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});

type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

// Handler with type-safe body
const createUserHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // event.body is now typed as CreateUserRequest and validated
  const userData = event.body as CreateUserRequest;

  // Business logic here
  const user = await createUser(userData);

  return {
    statusCode: 201,
    body: JSON.stringify(user),
  };
};

// Clean middleware stack
export const handler = middy(createUserHandler)
  .use(jsonBodyParser())
  .use(parser({ schema: CreateUserRequestSchema })) // Direct Zod integration
  .use(httpErrorHandler());
```

## Why This Approach is Better

### ✅ Advantages of Custom Parser

- **Direct Zod integration** - no transpilation needed
- **Cleaner error handling** - direct access to Zod issues
- **Type safety** - request.event.body is properly typed after validation
- **Better performance** - no schema transpilation overhead
- **Simpler configuration** - just pass the Zod schema directly
- **Better debugging** - clearer error messages and stack traces

### ❌ Problems with Generic Validator

```typescript
// Don't use this approach
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";

export const handler = middy(myHandler).use(
  validator({
    eventSchema: transpileSchema(MyRequestSchema), // Extra transpilation step
  })
);
```

**Issues with generic validator:**

- Requires schema transpilation (extra overhead)
- Less clear error messages
- More complex configuration
- Potential type safety issues
- Additional dependency on transpiler

## Enhanced Parser with Powertools

### Parser with Observability

```typescript
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Metrics, MetricUnits } from "@aws-lambda-powertools/metrics";

const parser = (options: {
  schema: z.ZodSchema;
  logger?: Logger;
  tracer?: Tracer;
  metrics?: Metrics;
}): middy.MiddlewareObj => ({
  before: async (request) => {
    const subsegment = options.tracer
      ?.getSegment()
      ?.addNewSubsegment("parse-request");

    try {
      options.logger?.debug("Parsing request with Zod schema", {
        operation: "parse-request",
        hasBody: !!request.event.body,
      });

      // Parse and validate the request body
      const result = options.schema.safeParse(request.event.body);

      if (!result.success) {
        options.logger?.warn("Request validation failed", {
          operation: "parse-request",
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });

        options.metrics?.addMetric(
          "RequestValidationFailed",
          MetricUnits.Count,
          1
        );

        subsegment?.addAnnotation("validationSuccess", false);
        subsegment?.close();

        throw new ValidationError(
          "Request validation failed",
          result.error.issues
        );
      }

      // Replace the raw body with the parsed and validated data
      request.event.body = result.data;

      options.logger?.debug("Request parsed successfully", {
        operation: "parse-request",
      });

      options.metrics?.addMetric(
        "RequestValidationSuccess",
        MetricUnits.Count,
        1
      );

      subsegment?.addAnnotation("validationSuccess", true);
      subsegment?.close();
    } catch (error) {
      subsegment?.addAnnotation("validationSuccess", false);
      subsegment?.addAnnotation("error", error.message);
      subsegment?.close(error);
      throw error;
    }
  },
});

// Usage with Powertools
export const handler = middy(myHandler)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics))
  .use(jsonBodyParser())
  .use(
    parser({
      schema: MyRequestSchema,
      logger,
      tracer,
      metrics,
    })
  )
  .use(httpErrorHandler());
```

## Error Handling

### Structured Error Response

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public issues: z.ZodIssue[]
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

const validationErrorHandler = (): middy.MiddlewareObj => ({
  onError: async (request) => {
    const { error } = request;

    if (error instanceof ValidationError) {
      request.response = {
        statusCode: 400,
        body: JSON.stringify({
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
      return;
    }
  },
});

// Use validation error handler
export const handler = middy(myHandler)
  .use(jsonBodyParser())
  .use(parser({ schema: MyRequestSchema }))
  .use(validationErrorHandler()) // Handle validation errors specifically
  .use(httpErrorHandler()); // Handle other errors
```

## Multiple Schema Validation

### Different Schemas for Different Endpoints

```typescript
// Define schemas for different operations
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

const GetUserByIdSchema = z.object({
  userId: z.string().uuid(),
});

// Use different parsers for different handlers
export const createUserHandler = middy(createUser)
  .use(jsonBodyParser())
  .use(parser({ schema: CreateUserSchema }))
  .use(httpErrorHandler());

export const updateUserHandler = middy(updateUser)
  .use(jsonBodyParser())
  .use(parser({ schema: UpdateUserSchema }))
  .use(httpErrorHandler());

export const getUserHandler = middy(getUser)
  .use(parser({ schema: GetUserByIdSchema })) // No JSON parser needed for path params
  .use(httpErrorHandler());
```

### Conditional Schema Validation

```typescript
const conditionalParser = (options: {
  schemas: Record<string, z.ZodSchema>;
  getSchemaKey: (event: any) => string;
}): middy.MiddlewareObj => ({
  before: async (request) => {
    const schemaKey = options.getSchemaKey(request.event);
    const schema = options.schemas[schemaKey];

    if (!schema) {
      throw new Error(`No schema found for key: ${schemaKey}`);
    }

    const result = schema.safeParse(request.event.body);

    if (!result.success) {
      throw new ValidationError(
        "Request validation failed",
        result.error.issues
      );
    }

    request.event.body = result.data;
  },
});

// Usage for multi-operation endpoints
export const handler = middy(multiOperationHandler)
  .use(jsonBodyParser())
  .use(
    conditionalParser({
      schemas: {
        create: CreateUserSchema,
        update: UpdateUserSchema,
        delete: DeleteUserSchema,
      },
      getSchemaKey: (event) => event.pathParameters?.operation || "create",
    })
  )
  .use(httpErrorHandler());
```

## Testing

### Unit Testing Parser Middleware

```typescript
describe("Custom Parser Middleware", () => {
  const TestSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  test("validates correct data", async () => {
    const middleware = parser({ schema: TestSchema });
    const mockRequest = {
      event: {
        body: { name: "John", age: 30 },
      },
    };

    await middleware.before!(mockRequest);

    expect(mockRequest.event.body).toEqual({ name: "John", age: 30 });
  });

  test("throws ValidationError for invalid data", async () => {
    const middleware = parser({ schema: TestSchema });
    const mockRequest = {
      event: {
        body: { name: "John", age: "invalid" },
      },
    };

    await expect(middleware.before!(mockRequest)).rejects.toThrow(
      ValidationError
    );
  });

  test("provides detailed error information", async () => {
    const middleware = parser({ schema: TestSchema });
    const mockRequest = {
      event: {
        body: { name: "", age: -1 },
      },
    };

    try {
      await middleware.before!(mockRequest);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.issues).toHaveLength(2);
      expect(error.issues[0].path).toEqual(["name"]);
      expect(error.issues[1].path).toEqual(["age"]);
    }
  });
});
```

## Performance Considerations

### Schema Reuse

```typescript
// Define schemas once and reuse
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// Reuse schema across multiple handlers
export const createUserHandler = middy(createUser)
  .use(jsonBodyParser())
  .use(parser({ schema: UserSchema })) // Reuse schema
  .use(httpErrorHandler());

export const updateUserHandler = middy(updateUser)
  .use(jsonBodyParser())
  .use(parser({ schema: UserSchema.partial() })) // Extend existing schema
  .use(httpErrorHandler());
```

### Lazy Schema Loading

```typescript
// For large schemas, consider lazy loading
const getLargeSchema = () => {
  if (!cachedSchema) {
    cachedSchema = z.object({
      // Large schema definition
    });
  }
  return cachedSchema;
};

let cachedSchema: z.ZodSchema | null = null;

export const handler = middy(myHandler)
  .use(jsonBodyParser())
  .use(parser({ schema: getLargeSchema() }))
  .use(httpErrorHandler());
```

This approach provides the cleanest, most performant, and most maintainable way to integrate Zod validation with Middy middleware.
