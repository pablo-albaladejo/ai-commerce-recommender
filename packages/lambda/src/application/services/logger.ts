// ============================================================================
// Logger - Application Service Interface (Port)
// ============================================================================

/**
 * Logger interface for dependency injection.
 * Infrastructure implementations must satisfy this contract.
 */
export type Logger = {
  debug(message: string, ...extra: unknown[]): void;
  info(message: string, ...extra: unknown[]): void;
  warn(message: string, ...extra: unknown[]): void;
  error(message: string, ...extra: unknown[]): void;
};
