// ============================================================================
// Domain Errors - Abuse Protection
// ============================================================================

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly info: {
      retryAfter?: number;
      limit: number;
      remaining: number;
    }
  ) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class DailyQuotaError extends Error {
  constructor(
    message: string,
    public readonly info: {
      limit: number;
      used: number;
      resetTime: string;
    }
  ) {
    super(message);
    this.name = 'DailyQuotaError';
    Object.setPrototypeOf(this, DailyQuotaError.prototype);
  }
}

export class TokenBudgetError extends Error {
  constructor(
    message: string,
    public readonly info: {
      limit: number;
      used: number;
      resetTime: string;
    }
  ) {
    super(message);
    this.name = 'TokenBudgetError';
    Object.setPrototypeOf(this, TokenBudgetError.prototype);
  }
}

// ============================================================================
// Domain Errors - Signature Validation
// ============================================================================

export class SignatureValidationError extends Error {
  public readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'SignatureValidationError';
    Object.setPrototypeOf(this, SignatureValidationError.prototype);
  }
}
