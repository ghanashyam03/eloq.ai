import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  windowMs: number;
}

export class RateLimiter {
  private readonly userRequestLogs: Map<string, number[]> = new Map();
  private readonly config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequestsPerMinute: config?.maxRequestsPerMinute ?? 60,
      windowMs: config?.windowMs ?? 60000, // 1 minute
    };
  }

  /**
   * Evaluates rate limit for a specific user ID or IP key.
   * Throws AppError.rateLimitExceeded if requested rate exceeds configured threshold.
   */
  public checkRateLimit(key: string): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let timestamps = this.userRequestLogs.get(key) || [];
    // Prune timestamps older than window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= this.config.maxRequestsPerMinute) {
      logger.warn("Rate limit exceeded for key", {
        key,
        count: timestamps.length,
        maxAllowed: this.config.maxRequestsPerMinute,
      });
      throw AppError.rateLimit(
        `Rate limit exceeded. Maximum ${this.config.maxRequestsPerMinute} requests per minute allowed.`
      );
    }

    timestamps.push(now);
    this.userRequestLogs.set(key, timestamps);
  }

  public reset(key?: string): void {
    if (key) {
      this.userRequestLogs.delete(key);
    } else {
      this.userRequestLogs.clear();
    }
  }
}

export const rateLimiter = new RateLimiter();
