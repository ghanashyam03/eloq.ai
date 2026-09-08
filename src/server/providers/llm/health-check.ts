import { modelRouter, ModelRouter } from "./router/model-router";
import { ProviderType } from "./registry/model-task.types";
import { config } from "@/lib/config/env";
import { logger } from "@/lib/logger/logger";

export interface ProviderHealthReport {
  provider: ProviderType;
  model: string;
  isConfigured: boolean;
  isHealthy: boolean;
  latencyMs: number;
  error?: string;
  freeOnlyEnforced: boolean;
  checkedAt: string;
}

export class LLMHealthCheckService {
  constructor(private readonly router: ModelRouter = modelRouter) {}

  /**
   * Checks the live health of a specified LLM provider with a strict timeout.
   * Never exposes API keys or secrets in logs or report output.
   */
  async checkProviderHealth(
    providerType: ProviderType = (config.PRIMARY_LLM_PROVIDER as ProviderType) ?? "gemini",
    overrideModel?: string
  ): Promise<ProviderHealthReport> {
    const isFreeOnlyEnforced = config.FREE_ONLY_MODE;
    const model = overrideModel ?? (providerType === "gemini" ? "gemini-2.0-flash" : "google/gemma-3-12b-it");
    const startTime = Date.now();

    // Verify key presence without exposing key value
    const isConfigured = this.verifyCredentialConfigured(providerType);

    if (!isConfigured) {
      return {
        provider: providerType,
        model,
        isConfigured: false,
        isHealthy: false,
        latencyMs: 0,
        error: `API key for provider '${providerType}' is not configured in environment`,
        freeOnlyEnforced: isFreeOnlyEnforced,
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const provider = this.router.getProvider(providerType);

      // Minimal test ping with 30000ms timeout
      const response = await provider.generateCompletion(
        [{ role: "user", content: "Reply with OK" }],
        {
          model,
          temperature: 0.1,
          maxTokens: 256,
          timeoutMs: config.DEFAULT_LLM_TIMEOUT_MS,
          taskType: "conversation",
        }
      );

      const latencyMs = Date.now() - startTime;
      const isHealthy = Boolean(response.content && response.content.trim().length > 0);

      if (isHealthy) {
        logger.info(`Live health check succeeded for provider '${providerType}'`, {
          provider: providerType,
          model,
          latencyMs,
        });
      } else {
        logger.warn(`Live health check failed for provider '${providerType}': Empty response content`, {
          provider: providerType,
          model,
          latencyMs,
        });
      }

      return {
        provider: providerType,
        model,
        isConfigured: true,
        isHealthy,
        latencyMs,
        ...(isHealthy ? {} : { error: "Provider returned empty completion content" }),
        freeOnlyEnforced: isFreeOnlyEnforced,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.warn(`Live health check failed for provider '${providerType}'`, {
        provider: providerType,
        model,
        latencyMs,
        error: errorMsg,
      });

      return {
        provider: providerType,
        model,
        isConfigured: true,
        isHealthy: false,
        latencyMs,
        error: errorMsg,
        freeOnlyEnforced: isFreeOnlyEnforced,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private verifyCredentialConfigured(providerType: ProviderType): boolean {
    switch (providerType) {
      case "gemini":
        return Boolean(config.GEMINI_API_KEY || process.env.GEMINI_API_KEY);
      case "nvidia":
        return Boolean(config.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY);
      case "cerebras":
        return Boolean(config.CEREBRAS_API_KEY || process.env.CEREBRAS_API_KEY);
      case "huggingface":
        return Boolean(config.HF_TOKEN || process.env.HF_TOKEN);
      case "openai-compatible":
      case "local":
      case "mock":
        return true;
      default:
        return false;
    }
  }
}

export const llmHealthCheckService = new LLMHealthCheckService();
