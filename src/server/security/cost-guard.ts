import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface CostGuardConfig {
  maxRequestsPerSession: number;
  maxRequestsPerDay: number;
  maxTokensPerDay: number;
  freeOnlyMode: boolean;
}

export class CostGuard {
  private readonly config: CostGuardConfig;
  private readonly userDailyUsage: Map<string, { requests: number; tokens: number; resetAt: number }> = new Map();
  private readonly sessionUsage: Map<string, number> = new Map();

  constructor(customConfig?: Partial<CostGuardConfig>) {
    this.config = {
      maxRequestsPerSession: customConfig?.maxRequestsPerSession ?? 60,
      maxRequestsPerDay: customConfig?.maxRequestsPerDay ?? 500,
      maxTokensPerDay: customConfig?.maxTokensPerDay ?? 100000,
      freeOnlyMode: customConfig?.freeOnlyMode ?? (process.env.FREE_ONLY_MODE !== "false"),
    };
  }

  /**
   * Validates that requested AI operation is within allowed user & daily cost limits.
   */
  public validateUsage(userId: string, sessionId?: string, estimatedTokens = 500): void {
    const now = Date.now();
    const dayMs = 86400000;

    // Check free-only guarantee
    if (this.config.freeOnlyMode && process.env.ENABLE_PAID_PROVIDERS === "true") {
      logger.error("Security violation: Paid inference flags enabled when free-only mode is active");
      throw AppError.externalProvider("router", "Free-only mode active; paid provider execution prohibited.");
    }

    // Check session limits
    if (sessionId) {
      const count = (this.sessionUsage.get(sessionId) ?? 0) + 1;
      if (count > this.config.maxRequestsPerSession) {
        throw AppError.rateLimit(`Session limit of ${this.config.maxRequestsPerSession} requests exceeded`);
      }
      this.sessionUsage.set(sessionId, count);
    }

    // Check daily user limits
    let daily = this.userDailyUsage.get(userId);
    if (!daily || now > daily.resetAt) {
      daily = { requests: 0, tokens: 0, resetAt: now + dayMs };
    }

    if (daily.requests >= this.config.maxRequestsPerDay) {
      throw AppError.rateLimit(`Daily user limit of ${this.config.maxRequestsPerDay} requests exceeded`);
    }

    if (daily.tokens + estimatedTokens > this.config.maxTokensPerDay) {
      throw AppError.rateLimit(`Daily user limit of ${this.config.maxTokensPerDay} tokens exceeded`);
    }

    daily.requests += 1;
    daily.tokens += estimatedTokens;
    this.userDailyUsage.set(userId, daily);
  }

  public isFreeOnlyMode(): boolean {
    return this.config.freeOnlyMode;
  }

  public reset(): void {
    this.userDailyUsage.clear();
    this.sessionUsage.clear();
  }
}

export const costGuard = new CostGuard();
