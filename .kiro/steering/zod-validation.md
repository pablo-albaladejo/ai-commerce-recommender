# Zod Validation Guidelines

## Always Use Zod for Data Validation

- **All external data must be validated with Zod schemas**
- This includes API requests, webhook payloads, environment variables, and configuration files
- Zod provides runtime type safety and clear error messages

## Schema-First Development

- Define Zod schemas before TypeScript types
- Derive TypeScript types from Zod schemas using `z.infer<>`
- This ensures runtime validation matches compile-time types

## Examples

✅ **Correct (Schema-first with Zod)**:

```typescript
import { z } from "zod";

// Define schema first
const UserSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
});

// Derive TypeScript type
type User = z.infer<typeof UserSchema>;

// Validate data at runtime
const validateUser = (data: unknown): User => {
  return UserSchema.parse(data); // Throws on invalid data
};

// Safe parsing (returns result object)
const safeValidateUser = (data: unknown) => {
  const result = UserSchema.safeParse(data);
  if (!result.success) {
    console.error("Validation failed:", result.error.format());
    return null;
  }
  return result.data;
};
```

❌ **Incorrect (Type-first without validation)**:

```typescript
// Don't define types without corresponding schemas
type User = {
  id: number;
  name: string;
  email: string;
  age?: number;
};

// Don't trust external data without validation
const processUser = (data: any) => {
  const user: User = data; // Unsafe!
  return user.name.toUpperCase(); // Could crash
};
```

## Common Patterns

### Environment Variables

```typescript
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
});

type Environment = z.infer<typeof EnvSchema>;
const env = EnvSchema.parse(process.env);
```

### API Request/Response

```typescript
const CreateProductRequestSchema = z.object({
  title: z.string().min(1).max(200),
  price: z.number().positive(),
  category: z.string(),
  tags: z.array(z.string()).optional(),
});

const ProductResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  price: z.number(),
  category: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
});

type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;
type ProductResponse = z.infer<typeof ProductResponseSchema>;
```

### Nested Objects

```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string().regex(/^\d{5}$/),
  country: z.string().length(2), // ISO country code
});

const UserWithAddressSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: AddressSchema,
  alternateAddresses: z.array(AddressSchema).optional(),
});
```

## Error Handling

### Structured Error Handling

```typescript
const handleValidationError = (error: z.ZodError) => {
  const formattedErrors = error.format();
  console.error("Validation errors:", formattedErrors);

  // Return user-friendly error messages
  return {
    success: false,
    errors: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
};

const processData = (rawData: unknown) => {
  const result = MySchema.safeParse(rawData);
  if (!result.success) {
    return handleValidationError(result.error);
  }

  // Data is now type-safe
  return { success: true, data: result.data };
};
```

## Testing Schemas

### Schema Validation Tests

```typescript
describe("UserSchema", () => {
  test("validates correct user data", () => {
    const validUser = {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      age: 30,
    };

    const result = UserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John Doe");
    }
  });

  test("rejects invalid email", () => {
    const invalidUser = {
      id: 1,
      name: "John Doe",
      email: "not-an-email",
    };

    const result = UserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["email"]);
    }
  });
});
```

## Performance Considerations

### Schema Reuse

```typescript
// Define schemas once and reuse
const BaseUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

// Extend schemas efficiently
const AdminUserSchema = BaseUserSchema.extend({
  permissions: z.array(z.string()),
  role: z.literal("admin"),
});

const RegularUserSchema = BaseUserSchema.extend({
  role: z.literal("user"),
});
```

### Preprocessing and Transforms

```typescript
const DateSchema = z.string().transform((str) => new Date(str));
const NumberStringSchema = z.string().transform((str) => parseInt(str, 10));

const ConfigSchema = z.object({
  port: z.string().transform(Number),
  enableFeature: z.string().transform((str) => str === "true"),
  createdAt: z
    .string()
    .datetime()
    .transform((str) => new Date(str)),
});
```

## Integration with Existing Code

When adding Zod to existing projects:

1. **Start with external boundaries** (API endpoints, environment variables)
2. **Add schemas for critical data flows**
3. **Gradually expand validation coverage**
4. **Update existing types to use `z.infer<>`**

## Dependencies

Add Zod to your package.json:

```json
{
  "dependencies": {
    "zod": "^3.22.0"
  }
}
```

This ensures all data flowing through the system is validated and type-safe at runtime, preventing many common bugs and security issues.
