---
inclusion: always
---

# Code Standards

## Language Requirements

### English-Only Code
- **ALL code must be written in English**: This is non-negotiable
- **Variable names**: Use descriptive English names (`userEmail`, not `correoUsuario`)
- **Function names**: Use English verbs and nouns (`calculatePrice`, not `calcularPrecio`)
- **Class names**: Use English nouns (`ProductCatalog`, not `CatalogoProductos`)
- **Interface names**: Use English descriptors (`SearchResult`, not `ResultadoBusqueda`)
- **Type definitions**: Use English terminology (`ProductType`, not `TipoProducto`)

### English-Only Comments
- **ALL comments must be in English**: This includes inline, block, and JSDoc comments
- **Code documentation**: README files, API docs, inline explanations
- **Error messages**: User-facing messages can be localized, but code-level errors in English
- **Console logs**: Debug and development logs in English
- **Git commit messages**: Write in English for consistency

### Examples

❌ **Incorrect (Spanish)**:
```typescript
// Función para buscar productos por categoría
function buscarProductosPorCategoria(categoria: string): Producto[] {
  const resultados = []; // Lista de productos encontrados
  // Iterar sobre todos los productos
  for (const producto of catalogo) {
    if (producto.categoria === categoria) {
      resultados.push(producto);
    }
  }
  return resultados;
}
```

✅ **Correct (English)**:
```typescript
// Function to search products by category
function searchProductsByCategory(category: string): Product[] {
  const results = []; // List of found products
  // Iterate over all products
  for (const product of catalog) {
    if (product.category === category) {
      results.push(product);
    }
  }
  return results;
}
```

## Naming Conventions

### Variables and Functions
- Use `camelCase` for variables and functions
- Use descriptive names: `userAuthToken` not `token`
- Use verbs for functions: `getUserData()`, `validateInput()`
- Use nouns for variables: `productList`, `searchQuery`

### Classes and Interfaces
- Use `PascalCase` for classes and interfaces
- Use descriptive nouns: `ProductCatalog`, `SearchEngine`
- Prefix interfaces with `I` if needed: `ISearchable`

### Constants
- Use `SCREAMING_SNAKE_CASE` for constants
- Use descriptive names: `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT_MS`

### Files and Directories
- Use `kebab-case` for file names: `product-search.ts`
- Use descriptive names that indicate purpose
- Group related files in appropriately named directories

## Documentation Standards

### JSDoc Comments
```typescript
/**
 * Searches for products using BM25 and embedding similarity
 * @param query - The search query string
 * @param filters - Optional filters to apply
 * @returns Promise resolving to ranked search results
 */
async function searchProducts(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
  // Implementation here
}
```

### Inline Comments
- Explain **why**, not **what**
- Use for complex business logic
- Keep comments concise and relevant
- Update comments when code changes

## Enforcement

### Code Reviews
- All code must pass English-only review
- Reject PRs with non-English code or comments
- Use linting rules to enforce naming conventions

### Automated Checks
- Configure ESLint rules for naming conventions
- Use spell-checkers for comments and documentation
- Set up pre-commit hooks to validate language standards

## Rationale

### Why English-Only?
1. **Global Collaboration**: English is the lingua franca of software development
2. **Tool Compatibility**: Most development tools expect English
3. **Documentation**: Technical documentation is primarily in English
4. **Maintenance**: Future developers can understand and maintain the code
5. **Open Source**: Enables broader community contribution
6. **Professional Standards**: Industry best practice for international projects

This standard applies **regardless of**:
- User's native language
- Input language in requests
- Geographic location of the team
- Client's preferred language

**Exception**: User-facing strings and messages can be localized, but the underlying code structure must remain in English.