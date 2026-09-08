export type ErrorCategory =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND_ERROR"
  | "DATABASE_ERROR"
  | "EXTERNAL_PROVIDER_ERROR"
  | "RATE_LIMIT_ERROR"
  | "TIMEOUT_ERROR"
  | "INTERNAL_ERROR";

export interface UserFacingErrorResponse {
  error: {
    code: ErrorCategory;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

/**
 * Base application error class supporting standardized codes, HTTP status mapping,
 * and sanitized client responses.
 */
export class AppError extends Error {
  public readonly code: ErrorCategory;
  public readonly statusCode: number;
  public readonly details: unknown;
  public readonly isOperational: boolean;

  constructor(params: {
    code: ErrorCategory;
    message: string;
    statusCode?: number;
    details?: unknown;
    isOperational?: boolean;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "AppError";
    this.code = params.code;
    this.statusCode = params.statusCode ?? this.getDefaultStatusCode(params.code);
    this.details = params.details;
    this.isOperational = params.isOperational ?? true;

    // Preserve stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  private getDefaultStatusCode(code: ErrorCategory): number {
    switch (code) {
      case "VALIDATION_ERROR":
        return 400;
      case "AUTHENTICATION_ERROR":
        return 401;
      case "AUTHORIZATION_ERROR":
        return 403;
      case "NOT_FOUND_ERROR":
        return 404;
      case "RATE_LIMIT_ERROR":
        return 429;
      case "TIMEOUT_ERROR":
        return 504;
      case "DATABASE_ERROR":
      case "EXTERNAL_PROVIDER_ERROR":
      case "INTERNAL_ERROR":
      default:
        return 500;
    }
  }

  /**
   * Serializes the error into a safe payload for client responses (no stack trace).
   */
  public toResponse(requestId?: string): UserFacingErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(requestId ? { requestId } : {}),
        ...(this.code === "VALIDATION_ERROR" && this.details ? { details: this.details } : {}),
      },
    };
  }

  // Factory methods for consistent error instantiation
  static validation(message: string, details?: unknown): AppError {
    return new AppError({ code: "VALIDATION_ERROR", message, statusCode: 400, details });
  }

  static authentication(message: string = "Authentication required"): AppError {
    return new AppError({ code: "AUTHENTICATION_ERROR", message, statusCode: 401 });
  }

  static authorization(message: string = "Access denied"): AppError {
    return new AppError({ code: "AUTHORIZATION_ERROR", message, statusCode: 403 });
  }

  static notFound(message: string = "Resource not found"): AppError {
    return new AppError({ code: "NOT_FOUND_ERROR", message, statusCode: 404 });
  }

  static database(message: string, cause?: unknown): AppError {
    return new AppError({ code: "DATABASE_ERROR", message, statusCode: 500, cause });
  }

  static externalProvider(provider: string, message: string, cause?: unknown): AppError {
    return new AppError({
      code: "EXTERNAL_PROVIDER_ERROR",
      message: `[${provider}] ${message}`,
      statusCode: 502,
      cause,
    });
  }

  static rateLimit(message: string = "Rate limit exceeded"): AppError {
    return new AppError({ code: "RATE_LIMIT_ERROR", message, statusCode: 429 });
  }

  static timeout(message: string = "Operation timed out"): AppError {
    return new AppError({ code: "TIMEOUT_ERROR", message, statusCode: 504 });
  }

  static internal(message: string = "An unexpected error occurred", cause?: unknown): AppError {
    return new AppError({ code: "INTERNAL_ERROR", message, statusCode: 500, cause });
  }
}
