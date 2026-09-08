import { ProviderType } from "./model-task.types";

export interface ProviderOperationalProfile {
  provider: ProviderType;
  displayName: string;
  healthStatus: "healthy" | "degraded" | "unhealthy";
  rateLimitState: "normal" | "rate_limited" | "quota_exhausted";
  freeOnlyEligible: boolean;
  timeoutMs: number;
  maxRetries: number;
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
  consecutiveFailures: number;
  dailyRequestBudget: number;
  dailyRequestsMade: number;
  escalationBudget: number;
  escalationsUsed: number;
  lastFailureTime?: number;
}

/**
 * Provider Profiles Registry tracking provider-level health, rate limits, capabilities, and budgets.
 */
export class ProviderProfileRegistry {
  private readonly profiles: Map<ProviderType, ProviderOperationalProfile> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const defaultProfiles: ProviderOperationalProfile[] = [
      {
        provider: "gemini",
        displayName: "Google Gemini",
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 30000,
        maxRetries: 2,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 1500,
        dailyRequestsMade: 0,
        escalationBudget: 500,
        escalationsUsed: 0,
      },
      {
        provider: "nvidia",
        displayName: "NVIDIA NIM",
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 30000,
        maxRetries: 2,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 1000,
        dailyRequestsMade: 0,
        escalationBudget: 200,
        escalationsUsed: 0,
      },
      {
        provider: "openrouter",
        displayName: "OpenRouter",
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 30000,
        maxRetries: 2,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 1000,
        dailyRequestsMade: 0,
        escalationBudget: 200,
        escalationsUsed: 0,
      },
      {
        provider: "cerebras",
        displayName: "Cerebras",
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 15000,
        maxRetries: 2,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 1000,
        dailyRequestsMade: 0,
        escalationBudget: 100,
        escalationsUsed: 0,
      },
      {
        provider: "huggingface",
        displayName: "Hugging Face",
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 30000,
        maxRetries: 2,
        supportsStructuredOutput: false,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 1000,
        dailyRequestsMade: 0,
        escalationBudget: 50,
        escalationsUsed: 0,
      },
      {
        provider: "openai-compatible",
        displayName: "OpenAI Compatible",
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 30000,
        maxRetries: 2,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 10000,
        dailyRequestsMade: 0,
        escalationBudget: 1000,
        escalationsUsed: 0,
      },
      {
        provider: "local",
        displayName: "Local Ollama",
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 30000,
        maxRetries: 1,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 10000,
        dailyRequestsMade: 0,
        escalationBudget: 1000,
        escalationsUsed: 0,
      },
      {
        provider: "mock",
        displayName: "Deterministic Test Mock",
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 1000,
        maxRetries: 0,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 100000,
        dailyRequestsMade: 0,
        escalationBudget: 10000,
        escalationsUsed: 0,
      },
    ];

    for (const prof of defaultProfiles) {
      this.profiles.set(prof.provider, prof);
    }
  }

  public getProfile(provider: ProviderType): ProviderOperationalProfile {
    const prof = this.profiles.get(provider);
    if (!prof) {
      return {
        provider,
        displayName: provider,
        healthStatus: "healthy",
        rateLimitState: "normal",
        freeOnlyEligible: true,
        timeoutMs: 30000,
        maxRetries: 2,
        supportsStructuredOutput: true,
        supportsStreaming: true,
        consecutiveFailures: 0,
        dailyRequestBudget: 1000,
        dailyRequestsMade: 0,
        escalationBudget: 200,
        escalationsUsed: 0,
      };
    }
    return prof;
  }

  public isAvailable(provider: ProviderType): boolean {
    const prof = this.getProfile(provider);
    if (prof.healthStatus === "unhealthy") return false;
    if (prof.rateLimitState === "quota_exhausted") return false;
    if (prof.dailyRequestsMade >= prof.dailyRequestBudget) return false;
    return true;
  }

  public canEscalate(provider: ProviderType): boolean {
    const prof = this.getProfile(provider);
    if (!this.isAvailable(provider)) return false;
    return prof.escalationsUsed < prof.escalationBudget;
  }

  public recordSuccess(provider: ProviderType): void {
    const prof = this.getProfile(provider);
    prof.consecutiveFailures = 0;
    prof.healthStatus = "healthy";
    prof.rateLimitState = "normal";
    prof.dailyRequestsMade++;
  }

  public recordEscalation(provider: ProviderType): void {
    const prof = this.getProfile(provider);
    prof.escalationsUsed++;
  }

  public recordFailure(provider: ProviderType, errorType?: "rate_limit" | "timeout" | "other"): void {
    const prof = this.getProfile(provider);
    prof.consecutiveFailures++;
    prof.lastFailureTime = Date.now();

    if (errorType === "rate_limit") {
      prof.rateLimitState = "rate_limited";
    }

    if (prof.consecutiveFailures >= 3) {
      prof.healthStatus = "degraded";
    }
    if (prof.consecutiveFailures >= 5) {
      prof.healthStatus = "unhealthy";
    }
  }

  public resetBudgets(): void {
    for (const prof of this.profiles.values()) {
      prof.dailyRequestsMade = 0;
      prof.escalationsUsed = 0;
      prof.consecutiveFailures = 0;
      prof.healthStatus = "healthy";
      prof.rateLimitState = "normal";
    }
  }
}

export const providerProfileRegistry = new ProviderProfileRegistry();
