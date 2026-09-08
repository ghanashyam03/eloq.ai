import { AppError, ErrorCategory } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface RetryOptions {
  maxAttempts?: number | undefined;
  initialDelayMs?: number | undefined;
  backoffFactor?: number | undefined;
  signal?: AbortSignal | undefined;
}

const RETRYABLE_ERROR_CODES: Set<ErrorCategory> = new Set([
  "RATE_LIMIT_ERROR",
  "TIMEOUT_ERROR",
  "EXTERNAL_PROVIDER_ERROR",
]);

/**
 * Determines whether an error is transient and safe to retry.
 * Non-retryable errors include validation errors, 400 Bad Request, auth failures, and invalid prompts.
 */
export function isRetryableError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "VALIDATION_ERROR" || code === "AUTHENTICATION_ERROR" || code === "AUTHORIZATION_ERROR" || code === "NOT_FOUND_ERROR") {
      return false;
    }
    if (RETRYABLE_ERROR_CODES.has(code as ErrorCategory)) {
      return true;
    }
  }

  if (error instanceof AppError) {
    if (RETRYABLE_ERROR_CODES.has(error.code)) {
      return true;
    }
    return false;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("fetch failed") ||
      msg.includes("network error") ||
      msg.includes("503") ||
      msg.includes("502") ||
      msg.includes("429")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Executes an operation with conservative exponential backoff retries.
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 200;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 1;
  let currentDelay = initialDelayMs;

  while (attempt <= maxAttempts) {
    if (options.signal?.aborted) {
      throw AppError.timeout("Operation cancelled via AbortSignal");
    }

    try {
      return await operation(attempt);
    } catch (error) {
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt >= maxAttempts) {
        logger.warn("Operation failed without retry", {
          attempt,
          maxAttempts,
          isRetryable,
        }, error);
        throw error;
      }

      logger.warn(`Transient error on attempt ${attempt}/${maxAttempts}. Retrying in ${currentDelay}ms...`, {
        attempt,
        nextDelayMs: currentDelay,
      }, error);

      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= backoffFactor;
      attempt++;
    }
  }

  throw AppError.internal("Retry handler reached unexpected termination");
}
