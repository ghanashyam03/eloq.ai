import { logger } from "@/lib/logger/logger";

export interface IdempotencyRecord {
  key: string;
  result: unknown;
  createdAt: number;
}

export class IdempotencyEngine {
  private readonly cache: Map<string, IdempotencyRecord> = new Map();
  private readonly ttlMs: number;

  constructor(ttlMs = 300000) { // 5 minutes default TTL
    this.ttlMs = ttlMs;
  }

  /**
   * Checks if an idempotency key has already been processed.
   * Returns cached result if present, or null if key is new.
   */
  public getCachedResult<T>(key: string): T | null {
    this.pruneExpiredKeys();
    const record = this.cache.get(key);
    if (record) {
      logger.info("Idempotency key match: returning cached result", { key });
      return record.result as T;
    }
    return null;
  }

  /**
   * Registers a processed result for an idempotency key.
   */
  public registerKey<T>(key: string, result: T): T {
    this.pruneExpiredKeys();
    this.cache.set(key, {
      key,
      result,
      createdAt: Date.now(),
    });
    return result;
  }

  private pruneExpiredKeys(): void {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now - record.createdAt > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const idempotencyEngine = new IdempotencyEngine();
