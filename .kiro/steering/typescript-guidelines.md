# TypeScript Guidelines

## Type Definitions

### Use `type` instead of `interface`

- **Always use `type` for type definitions** instead of `interface`
- This ensures consistency across the codebase and aligns with functional programming patterns
- `type` definitions are more flexible and can represent union types, primitives, and complex compositions

### Examples

❌ **Incorrect (using interface)**:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

interface ApiResponse {
  data: User[];
  status: string;
}
```

✅ **Correct (using type)**:

```typescript
type User = {
  id: number;
  name: string;
  email: string;
};

type ApiResponse = {
  data: User[];
  status: string;
};
```

### Complex Type Compositions

`type` definitions excel at complex compositions:

```typescript
// Union types
type Status = "pending" | "approved" | "rejected";

// Conditional types
type ApiResult<T> = T extends string ? { message: T } : { data: T };

// Mapped types
type Partial<T> = {
  [P in keyof T]?: T[P];
};

// Function types
type EventHandler = (event: Event) => void;

// Intersection types
type UserWithPermissions = User & {
  permissions: string[];
  role: "admin" | "user";
};
```

### When to Use Each

**Use `type` for:**

- Object shapes and data structures
- Union and intersection types
- Function signatures
- Complex type compositions
- All new code in this project

**Avoid `interface` except for:**

- Extending third-party library interfaces (when required)
- Declaration merging (rare cases)

## Naming Conventions

### Type Names

- Use `PascalCase` for type names
- Use descriptive names that indicate the data structure
- Prefix with the domain when needed for clarity

```typescript
type ProductCatalog = {
  products: Product[];
  categories: Category[];
};

type TelegramMessage = {
  message_id: number;
  text: string;
  from: TelegramUser;
};

type SearchFilters = {
  priceRange?: [number, number];
  category?: string;
  availability?: boolean;
};
```

### Generic Types

- Use single uppercase letters for simple generics: `T`, `U`, `V`
- Use descriptive names for complex generics: `TData`, `TResponse`

```typescript
type ApiResponse<T> = {
  data: T;
  status: number;
  message: string;
};

type EventHandler<TEvent> = (event: TEvent) => void;
```

## Documentation

### JSDoc for Types

Document complex types with JSDoc comments:

```typescript
/**
 * Represents a product in the catalog with all necessary metadata
 * for search and recommendation algorithms
 */
type Product = {
  /** Unique product identifier */
  id: number;
  /** Product title for display */
  title: string;
  /** Normalized text used for BM25 search */
  doc_text: string;
  /** Product availability status */
  available: boolean;
  /** Price range for the product */
  price_min: number;
  price_max: number;
};
```

## Migration from Interfaces

When updating existing code:

1. **Replace `interface` with `type`**
2. **Change declaration syntax from `interface Name {}` to `type Name = {}`**
3. **Update any interface extensions to use intersection types**

```typescript
// Before
interface BaseUser {
  id: number;
  name: string;
}

interface AdminUser extends BaseUser {
  permissions: string[];
}

// After
type BaseUser = {
  id: number;
  name: string;
};

type AdminUser = BaseUser & {
  permissions: string[];
};
```

## Enforcement

- All new type definitions must use `type`
- Code reviews should flag any new `interface` usage
- Consider adding ESLint rules to enforce this pattern
- Update existing interfaces to types during refactoring

This guideline ensures consistency and leverages TypeScript's type system more effectively across the entire codebase.
