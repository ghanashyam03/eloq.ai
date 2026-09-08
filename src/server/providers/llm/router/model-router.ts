import { z } from "zod";
import { LLMProvider, LLMMessage, LLMCompletionOptions, LLMResponse } from "../llm-provider.interface";
import { LLMTaskType, ProviderType, RoutingDecision, ModelMetadata } from "../registry/model-task.types";
import { ModelRegistry, modelRegistry } from "../registry/model-registry";
import { getTaskRequirementProfile, TaskRequirementProfile } from "../registry/task-risk-taxonomy";
import { providerProfileRegistry, ProviderProfileRegistry } from "../registry/provider-profiles";
import { executeWithRetry, isRetryableError } from "./retry-handler";
import { usageTracker } from "../metrics/usage-tracker";
import { AppError } from "@/lib/errors/app-error";
import { config } from "@/lib/config/env";
import { logger } from "@/lib/logger/logger";

// Provider implementations
import { GeminiLLMProvider } from "../implementations/gemini.provider";
import { NvidiaLLMProvider } from "../implementations/nvidia.provider";
import { HuggingFaceLLMProvider } from "../implementations/huggingface.provider";
import { CerebrasLLMProvider } from "../implementations/cerebras.provider";
import { OpenRouterLLMProvider } from "../implementations/openrouter.provider";
import { OpenAICompatibleLLMProvider } from "../implementations/openai-compatible.provider";
import { MockLLMProvider } from "../implementations/mock.provider";

export interface RouterRequestOptions extends LLMCompletionOptions {
  taskType: LLMTaskType;
  requiresStructuredOutput?: boolean;
  providerOverride?: ProviderType;
  modelOverride?: string;
  disableFallback?: boolean;
}

export interface StructuredRoutingResult<T> {
  data: T;
  decision: RoutingDecision;
  underlyingModel: string;
}

/**
 * Production-grade Risk-Aware & Context-Aware AI Model Router selecting appropriate
 * provider/model based on task risk level, linguistic precision, model quality gates,
 * provider health, OpenRouter tracking, and smart escalation.
 */
export class ModelRouter {
  private readonly providerCache: Map<string, LLMProvider> = new Map();

  constructor(
    private readonly registry: ModelRegistry = modelRegistry,
    private readonly providerProfiles: ProviderProfileRegistry = providerProfileRegistry
  ) {}

  /**
   * Instantiates or retrieves cached provider instances.
   */
  public getProvider(providerType: ProviderType): LLMProvider {
    if (this.providerCache.has(providerType)) {
      return this.providerCache.get(providerType)!;
    }

    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      return new MockLLMProvider();
    }

    let provider: LLMProvider;
    switch (providerType) {
      case "gemini":
        provider = config.GEMINI_API_KEY ? new GeminiLLMProvider() : new MockLLMProvider();
        break;
      case "nvidia":
        provider = config.NVIDIA_API_KEY ? new NvidiaLLMProvider() : new MockLLMProvider();
        break;
      case "huggingface":
        provider = config.HF_TOKEN ? new HuggingFaceLLMProvider() : new MockLLMProvider();
        break;
      case "cerebras":
        provider = config.CEREBRAS_API_KEY ? new CerebrasLLMProvider() : new MockLLMProvider();
        break;
      case "openrouter":
        provider = config.OPENROUTER_API_KEY ? new OpenRouterLLMProvider() : new MockLLMProvider();
        break;
      case "openai-compatible":
        provider = new OpenAICompatibleLLMProvider();
        break;
      case "mock":
        provider = new MockLLMProvider();
        break;
      case "local":
        provider = new OpenAICompatibleLLMProvider({
          baseUrl: "http://localhost:11434/v1",
          providerName: "local",
          isFree: true,
        });
        break;
      default:
        throw AppError.internal(`Unsupported provider type: ${providerType}`);
    }

    this.providerCache.set(providerType, provider);
    return provider;
  }

  /**
   * Directly registers a custom or mocked provider instance (e.g. for testing).
   */
  public registerProvider(type: ProviderType, provider: LLMProvider): void {
    this.providerCache.set(type, provider);
  }

  /**
   * Evaluates task risk, model capability profiles, provider health, and produces a RoutingDecision.
   */
  public resolveRoutingDecision(options: RouterRequestOptions): RoutingDecision {
    const taskProfile = getTaskRequirementProfile(options.taskType);
    const timestamp = new Date().toISOString();

    // 1. Intercept Deterministic Tasks Immediately (Zero LLM Invocation)
    if (taskProfile.riskLevel === "DETERMINISTIC") {
      return {
        taskType: options.taskType,
        riskLevel: "DETERMINISTIC",
        requiredCapabilities: taskProfile,
        candidateModels: [],
        rejectedCandidates: [{ modelId: "all_llm_models", reason: "Deterministic task must be computed locally without LLM." }],
        selectedProvider: "mock",
        selectedRouterModel: "deterministic_local",
        selectedUnderlyingModel: "deterministic_local",
        selectionReason: `Task '${options.taskType}' is classified as DETERMINISTIC. Computed locally with zero LLM overhead.`,
        escalationAllowed: false,
        fallbackPolicy: "none",
        qualityStatus: "safe_for_primary",
        timestamp,
      };
    }

    // 2. Handle Explicit Benchmark / Provider Overrides
    if (options.providerOverride) {
      const selectedProvider = options.providerOverride;
      const selectedModelId = options.modelOverride ?? options.model ?? "default";
      const modelMeta = this.registry.getModel(selectedProvider, selectedModelId);

      return {
        taskType: options.taskType,
        riskLevel: taskProfile.riskLevel,
        requiredCapabilities: taskProfile,
        candidateModels: [`${selectedProvider}:${selectedModelId}`],
        rejectedCandidates: [],
        selectedProvider,
        selectedRouterModel: selectedModelId,
        selectedUnderlyingModel: selectedModelId,
        selectionReason: `Explicit provider override requested for '${selectedProvider}:${selectedModelId}' (Benchmark/Test mode).`,
        escalationAllowed: false,
        fallbackPolicy: options.disableFallback ? "disabled" : "enabled",
        qualityStatus: modelMeta?.linguisticQualityStatus ?? "safe_for_primary",
        timestamp,
      };
    }

    const isFreeOnly = config.FREE_ONLY_MODE;
    const { candidates, rejected } = this.registry.getCandidatesForRequirementProfile(taskProfile, isFreeOnly);

    // 3. Filter candidates by Provider Operational Health & Budgets
    const healthyCandidates: ModelMetadata[] = [];
    for (const candidate of candidates) {
      const modelKey = `${candidate.provider}:${candidate.modelId}`;
      if (!this.providerProfiles.isAvailable(candidate.provider)) {
        rejected.push({
          modelId: modelKey,
          reason: `Provider '${candidate.provider}' is currently unavailable, rate limited, or daily budget exhausted.`,
        });
        continue;
      }
      healthyCandidates.push(candidate);
    }

    if (healthyCandidates.length === 0) {
      if (isFreeOnly) {
        throw AppError.externalProvider(
          "router",
          `No configured free AI provider satisfying requirements for task '${options.taskType}' (${taskProfile.riskLevel} risk) is currently available.`
        );
      }
      throw AppError.externalProvider("router", `No eligible candidates found for task '${options.taskType}'`);
    }

    // 4. Rank Candidates Based on Risk Level & Quality Fit
    const rankedCandidates = this.rankCandidates(healthyCandidates, taskProfile);
    const topCandidate = rankedCandidates[0]!;

    const fallbackCandidate = rankedCandidates.find(
      (c) => c.provider !== topCandidate.provider || c.modelId !== topCandidate.modelId
    );

    const selectionReason = this.buildSelectionReason(topCandidate, taskProfile, rejected);

    return {
      taskType: options.taskType,
      riskLevel: taskProfile.riskLevel,
      requiredCapabilities: taskProfile,
      candidateModels: rankedCandidates.map((c) => `${c.provider}:${c.modelId}`),
      rejectedCandidates: rejected,
      selectedProvider: topCandidate.provider,
      selectedRouterModel: topCandidate.modelId,
      selectedUnderlyingModel: topCandidate.modelId === "openrouter/free" ? "UNKNOWN_UNDERLYING_MODEL" : topCandidate.modelId,
      selectionReason,
      escalationAllowed: taskProfile.escalationAllowed,
      fallbackPolicy: fallbackCandidate ? `Fallback to ${fallbackCandidate.provider}:${fallbackCandidate.modelId}` : "none",
      qualityStatus: topCandidate.linguisticQualityStatus ?? "safe_for_primary",
      timestamp,
    };
  }

  /**
   * Rank candidates according to task risk criteria:
   * For CRITICAL/HIGH risk: Quality & precision dominate latency ($0.70 \times \text{quality} + 0.20 \times \text{schema} + 0.10 \times \text{latency}$).
   * For LOW risk: Latency & efficiency dominate ($0.45 \times \text{latency} + 0.45 \times \text{quality} + 0.10 \times \text{cost}$).
   */
  private rankCandidates(candidates: ModelMetadata[], taskProfile: TaskRequirementProfile): ModelMetadata[] {
    return [...candidates].sort((a, b) => {
      const aQuality = a.qualityProfile?.grammarPrecision ?? (a.linguisticQualityStatus === "safe_for_primary" ? 0.95 : 0.70);
      const bQuality = b.qualityProfile?.grammarPrecision ?? (b.linguisticQualityStatus === "safe_for_primary" ? 0.95 : 0.70);

      const aLatencyScore = a.qualityProfile?.latencyClass === "ultra_fast" ? 1.0 : a.qualityProfile?.latencyClass === "fast" ? 0.8 : 0.5;
      const bLatencyScore = b.qualityProfile?.latencyClass === "ultra_fast" ? 1.0 : b.qualityProfile?.latencyClass === "fast" ? 0.8 : 0.5;

      let scoreA = 0;
      let scoreB = 0;

      if (taskProfile.riskLevel === "CRITICAL" || taskProfile.riskLevel === "HIGH") {
        scoreA = aQuality * 0.70 + (a.qualityProfile?.schemaReliability ?? 0.9) * 0.20 + aLatencyScore * 0.10;
        scoreB = bQuality * 0.70 + (b.qualityProfile?.schemaReliability ?? 0.9) * 0.20 + bLatencyScore * 0.10;
      } else {
        scoreA = aLatencyScore * 0.45 + aQuality * 0.45 + (a.isFree ? 0.10 : 0.0);
        scoreB = bLatencyScore * 0.45 + bQuality * 0.45 + (b.isFree ? 0.10 : 0.0);
      }

      // Prioritize configured primary provider if scores tie
      if (Math.abs(scoreA - scoreB) < 0.01) {
        if (a.provider === config.PRIMARY_LLM_PROVIDER) return -1;
        if (b.provider === config.PRIMARY_LLM_PROVIDER) return 1;
      }

      return scoreB - scoreA;
    });
  }

  private buildSelectionReason(
    selected: ModelMetadata,
    profile: TaskRequirementProfile,
    rejected: Array<{ modelId: string; reason: string }>
  ): string {
    const rejectedSummary = rejected.length > 0
      ? ` Rejected candidates: ${rejected.map((r) => `${r.modelId} (${r.reason})`).join("; ")}.`
      : "";

    return `Selected '${selected.provider}:${selected.modelId}' because task is '${profile.taskType}' (${profile.riskLevel} risk, min quality '${profile.minimumLinguisticQuality}'). Model satisfies mandatory capability gates and provider is healthy.${rejectedSummary}`;
  }

  /**
   * Executes a text completion using dynamic risk-aware route resolution.
   */
  public async generateCompletion(
    messages: readonly LLMMessage[],
    options: RouterRequestOptions
  ): Promise<LLMResponse> {
    const decision = this.resolveRoutingDecision(options);

    if (decision.riskLevel === "DETERMINISTIC") {
      throw AppError.validation(`Task '${options.taskType}' is DETERMINISTIC and must be calculated locally without an LLM.`);
    }

    try {
      const response = await this.executeProviderCall(
        decision.selectedProvider,
        decision.selectedRouterModel,
        messages,
        options
      );

      this.providerProfiles.recordSuccess(decision.selectedProvider);

      // Extract OpenRouter underlying model if available
      let underlyingModel = decision.selectedUnderlyingModel;
      if (decision.selectedProvider === "openrouter" && response.rawResponse) {
        const rawObj = response.rawResponse as Record<string, unknown>;
        underlyingModel = String(rawObj["model"] ?? rawObj["underlying_model"] ?? "openrouter/free");
      }

      logger.info("Risk-aware LLM completion succeeded", {
        taskType: options.taskType,
        riskLevel: decision.riskLevel,
        selectedProvider: decision.selectedProvider,
        selectedRouterModel: decision.selectedRouterModel,
        underlyingModel,
        latencyMs: response.latencyMs,
      });

      return {
        ...response,
        model: underlyingModel,
      };
    } catch (primaryError) {
      this.providerProfiles.recordFailure(
        decision.selectedProvider,
        primaryError instanceof AppError && primaryError.code === "RATE_LIMIT_ERROR" ? "rate_limit" : "other"
      );

      if (!isRetryableError(primaryError) || options.disableFallback) {
        throw primaryError;
      }

      // Fallback Resolution
      return this.handleFallbackCompletion(messages, options, decision, primaryError);
    }
  }

  /**
   * Executes a structured JSON completion with task routing, OpenRouter underlying model tracking, and schema validation.
   */
  public async generateStructured<T>(
    messages: readonly LLMMessage[],
    schema: z.ZodType<T>,
    options: RouterRequestOptions
  ): Promise<T> {
    const decision = this.resolveRoutingDecision(options);

    if (decision.riskLevel === "DETERMINISTIC") {
      throw AppError.validation(`Task '${options.taskType}' is DETERMINISTIC and must be calculated locally without an LLM.`);
    }

    try {
      const provider = this.getProvider(decision.selectedProvider);
      const startTime = Date.now();

      const result = await executeWithRetry(
        async () =>
          provider.generateStructured(messages, schema, {
            ...options,
            model: decision.selectedRouterModel,
          }),
        { maxAttempts: 2, signal: options.signal }
      );

      this.providerProfiles.recordSuccess(decision.selectedProvider);

      usageTracker.recordUsage({
        taskType: options.taskType,
        provider: decision.selectedProvider,
        model: decision.selectedRouterModel,
        promptTokens: messages.reduce((a, b) => a + b.content.length, 0),
        completionTokens: JSON.stringify(result).length,
        totalTokens: messages.reduce((a, b) => a + b.content.length, 0) + JSON.stringify(result).length,
        latencyMs: Date.now() - startTime,
        success: true,
      });

      logger.info("Risk-aware structured completion succeeded", {
        taskType: options.taskType,
        riskLevel: decision.riskLevel,
        selectedProvider: decision.selectedProvider,
        selectedRouterModel: decision.selectedRouterModel,
        latencyMs: Date.now() - startTime,
      });

      return result;
    } catch (primaryError) {
      this.providerProfiles.recordFailure(
        decision.selectedProvider,
        primaryError instanceof AppError && primaryError.code === "RATE_LIMIT_ERROR" ? "rate_limit" : "other"
      );

      if (!isRetryableError(primaryError) || options.disableFallback) {
        throw primaryError;
      }

      return this.handleFallbackStructured(messages, schema, options, decision, primaryError);
    }
  }

  /**
   * Escalates a task to a TRUSTED high-quality model (Gemini) when Pass 1 analysis on an acceptable model yields verifier disagreement or low confidence.
   */
  public async escalateStructured<T>(
    messages: readonly LLMMessage[],
    schema: z.ZodType<T>,
    options: RouterRequestOptions,
    escalationReason: string
  ): Promise<T> {
    const taskProfile = getTaskRequirementProfile(options.taskType);

    if (!taskProfile.escalationAllowed) {
      throw AppError.validation(`Escalation is not permitted for task '${options.taskType}'`);
    }

    const trustedProvider: ProviderType = "gemini";
    if (!this.providerProfiles.canEscalate(trustedProvider)) {
      logger.warn("Escalation requested but escalation budget exhausted for Gemini", { taskType: options.taskType });
      throw AppError.externalProvider("router", "Escalation budget exhausted");
    }

    logger.warn(`Triggering dynamic escalation to trusted provider '${trustedProvider}'... Reason: ${escalationReason}`, {
      taskType: options.taskType,
    });

    this.providerProfiles.recordEscalation(trustedProvider);

    const provider = this.getProvider(trustedProvider);
    const startTime = Date.now();

    const cleanOptions = { ...options };
    delete (cleanOptions as Partial<RouterRequestOptions>).providerOverride;
    const result = await executeWithRetry(
      async () =>
        provider.generateStructured(messages, schema, {
          ...cleanOptions,
          model: "gemini-2.0-flash",
        }),
      { maxAttempts: 2, signal: options.signal }
    );

    this.providerProfiles.recordSuccess(trustedProvider);

    usageTracker.recordUsage({
      taskType: options.taskType,
      provider: trustedProvider,
      model: "gemini-2.0-flash",
      promptTokens: messages.reduce((a, b) => a + b.content.length, 0),
      completionTokens: JSON.stringify(result).length,
      totalTokens: messages.reduce((a, b) => a + b.content.length, 0) + JSON.stringify(result).length,
      latencyMs: Date.now() - startTime,
      success: true,
    });

    return result;
  }

  private async handleFallbackCompletion(
    messages: readonly LLMMessage[],
    options: RouterRequestOptions,
    primaryDecision: RoutingDecision,
    primaryError: unknown
  ): Promise<LLMResponse> {
    const taskProfile = primaryDecision.requiredCapabilities;
    const isFreeOnly = config.FREE_ONLY_MODE;

    const { candidates } = this.registry.getCandidatesForRequirementProfile(taskProfile, isFreeOnly);
    const fallbackCandidates = candidates.filter((c) => c.provider !== primaryDecision.selectedProvider);

    for (const fallbackModel of fallbackCandidates) {
      try {
        logger.warn(
          `Primary provider '${primaryDecision.selectedProvider}' failed. Failing over to '${fallbackModel.provider}:${fallbackModel.modelId}'...`,
          {
            taskType: options.taskType,
            primaryProvider: primaryDecision.selectedProvider,
            fallbackProvider: fallbackModel.provider,
          },
          primaryError
        );

        const response = await this.executeProviderCall(fallbackModel.provider, fallbackModel.modelId, messages, options);
        this.providerProfiles.recordSuccess(fallbackModel.provider);
        return response;
      } catch (fallbackErr) {
        this.providerProfiles.recordFailure(
          fallbackModel.provider,
          fallbackErr instanceof AppError && fallbackErr.code === "RATE_LIMIT_ERROR" ? "rate_limit" : "other"
        );
      }
    }

    if (isFreeOnly) {
      throw AppError.externalProvider(
        "router",
        "No configured free AI provider is currently available.",
        primaryError
      );
    }
    throw primaryError;
  }

  private async handleFallbackStructured<T>(
    messages: readonly LLMMessage[],
    schema: z.ZodType<T>,
    options: RouterRequestOptions,
    primaryDecision: RoutingDecision,
    primaryError: unknown
  ): Promise<T> {
    const taskProfile = primaryDecision.requiredCapabilities;
    const isFreeOnly = config.FREE_ONLY_MODE;

    const { candidates } = this.registry.getCandidatesForRequirementProfile(taskProfile, isFreeOnly);
    const fallbackCandidates = candidates.filter((c) => c.provider !== primaryDecision.selectedProvider);

    for (const fallbackModel of fallbackCandidates) {
      try {
        logger.warn(
          `Primary structured provider '${primaryDecision.selectedProvider}' failed. Failing over to '${fallbackModel.provider}:${fallbackModel.modelId}'...`,
          {
            taskType: options.taskType,
          },
          primaryError
        );

        const provider = this.getProvider(fallbackModel.provider);
        const startTime = Date.now();

        const result = await executeWithRetry(
          async () =>
            provider.generateStructured(messages, schema, {
              ...options,
              model: fallbackModel.modelId,
            }),
          { maxAttempts: 2, signal: options.signal }
        );

        this.providerProfiles.recordSuccess(fallbackModel.provider);

        usageTracker.recordUsage({
          taskType: options.taskType,
          provider: fallbackModel.provider,
          model: fallbackModel.modelId,
          promptTokens: messages.reduce((a, b) => a + b.content.length, 0),
          completionTokens: JSON.stringify(result).length,
          totalTokens: messages.reduce((a, b) => a + b.content.length, 0) + JSON.stringify(result).length,
          latencyMs: Date.now() - startTime,
          success: true,
        });

        return result;
      } catch (fallbackErr) {
        this.providerProfiles.recordFailure(
          fallbackModel.provider,
          fallbackErr instanceof AppError && fallbackErr.code === "RATE_LIMIT_ERROR" ? "rate_limit" : "other"
        );
      }
    }

    if (isFreeOnly) {
      throw AppError.externalProvider(
        "router",
        "No configured free AI provider is currently available.",
        primaryError
      );
    }
    throw primaryError;
  }

  private async executeProviderCall(
    providerType: ProviderType,
    modelId: string,
    messages: readonly LLMMessage[],
    options: RouterRequestOptions
  ): Promise<LLMResponse> {
    const provider = this.getProvider(providerType);

    const response = await executeWithRetry(
      async () =>
        provider.generateCompletion(messages, {
          ...options,
          model: modelId,
        }),
      { maxAttempts: 2, signal: options.signal }
    );

    usageTracker.recordUsage({
      taskType: options.taskType,
      provider: providerType,
      model: modelId,
      promptTokens: response.usage?.promptTokens ?? 0,
      completionTokens: response.usage?.completionTokens ?? 0,
      totalTokens: response.usage?.totalTokens ?? 0,
      latencyMs: response.latencyMs,
      success: true,
    });

    return response;
  }
}

export const modelRouter = new ModelRouter();
