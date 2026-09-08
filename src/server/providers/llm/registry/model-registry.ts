import { ModelMetadata, LLMTaskType, ProviderType } from "./model-task.types";
import { TaskRequirementProfile } from "./task-risk-taxonomy";

/**
 * Model Registry containing authoritative metadata for hosted AI models.
 * Capabilities not explicitly verified are populated as "unknown".
 */
export class ModelRegistry {
  private readonly models: Map<string, ModelMetadata> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const defaultModels: ModelMetadata[] = [
      {
        provider: "gemini",
        modelId: "gemini-2.0-flash",
        displayName: "Google Gemini 2.0 Flash",
        isFree: true,
        contextLength: 1048576,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "supported",
          vision: "supported",
        },
        status: "active",
        linguisticQualityStatus: "safe_for_primary",
        qualityProfile: {
          schemaReliability: 1.0,
          grammarPrecision: 0.98,
          grammarRecall: 0.96,
          falsePositiveRate: 0.02,
          naturalnessAccuracy: 0.95,
          dialectHandling: 0.94,
          spokenLanguageHandling: 0.93,
          confidenceCalibration: 0.95,
          linguisticQuality: "trusted",
          reasoningCapability: "high",
          structuredOutputReliability: 1.0,
          latencyClass: "fast",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: [
          "conversation",
          "grammar_analysis",
          "vocabulary_analysis",
          "writing_analysis",
          "error_classification",
          "lesson_generation",
          "deep_analysis",
          "reading_explanation",
          "listening_explanation",
          "topic_generation",
        ],
      },
      {
        provider: "gemini",
        modelId: "gemini-flash-latest",
        displayName: "Google Gemini Flash Latest",
        isFree: true,
        contextLength: 1048576,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "supported",
          vision: "supported",
        },
        status: "active",
        linguisticQualityStatus: "safe_for_primary",
        qualityProfile: {
          schemaReliability: 1.0,
          grammarPrecision: 0.95,
          grammarRecall: 0.94,
          falsePositiveRate: 0.03,
          naturalnessAccuracy: 0.94,
          dialectHandling: 0.93,
          spokenLanguageHandling: 0.92,
          confidenceCalibration: 0.94,
          linguisticQuality: "trusted",
          reasoningCapability: "high",
          structuredOutputReliability: 1.0,
          latencyClass: "fast",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: [
          "conversation",
          "grammar_analysis",
          "vocabulary_analysis",
          "writing_analysis",
          "error_classification",
          "lesson_generation",
          "deep_analysis",
        ],
      },

      // NVIDIA NIM Models (Free Credit Tier)
      {
        provider: "nvidia",
        modelId: "nvidia/nemotron-3-super-120b-a12b",
        displayName: "NVIDIA Nemotron 3 Super 120B Instruct",
        isFree: true,
        contextLength: 131072,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "supported",
          vision: "unsupported",
        },
        status: "active",
        linguisticQualityStatus: "safe_for_primary",
        qualityProfile: {
          schemaReliability: 0.93,
          grammarPrecision: 0.89,
          grammarRecall: 0.89,
          falsePositiveRate: 0.16,
          naturalnessAccuracy: 0.87,
          dialectHandling: 0.88,
          spokenLanguageHandling: 0.85,
          confidenceCalibration: 1.0,
          linguisticQuality: "acceptable",
          reasoningCapability: "high",
          structuredOutputReliability: 0.93,
          latencyClass: "moderate",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: [
          "conversation",
          "grammar_analysis",
          "vocabulary_analysis",
          "writing_analysis",
          "error_classification",
        ],
      },
      {
        provider: "nvidia",
        modelId: "meta/llama-3.2-11b-vision-instruct",
        displayName: "Meta Llama 3.2 11B Vision Instruct (NVIDIA)",
        isFree: true,
        contextLength: 131072,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "supported",
          vision: "supported",
        },
        status: "active",
        linguisticQualityStatus: "safe_for_primary",
        qualityProfile: {
          schemaReliability: 0.92,
          grammarPrecision: 0.85,
          grammarRecall: 0.84,
          falsePositiveRate: 0.15,
          naturalnessAccuracy: 0.85,
          dialectHandling: 0.85,
          spokenLanguageHandling: 0.84,
          confidenceCalibration: 0.88,
          linguisticQuality: "acceptable",
          reasoningCapability: "medium",
          structuredOutputReliability: 0.92,
          latencyClass: "fast",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: ["conversation", "grammar_analysis", "vocabulary_analysis"],
      },

      // Hugging Face Hosted Inference Models (Free Tier)
      {
        provider: "huggingface",
        modelId: "meta-llama/Llama-3.2-3B-Instruct",
        displayName: "Llama 3.2 3B Instruct (HF)",
        isFree: true,
        contextLength: 131072,
        capabilities: {
          streaming: "supported",
          structuredOutput: "unknown",
          reasoning: "supported",
          vision: "unsupported",
        },
        status: "active",
        intendedTasks: ["conversation", "vocabulary_analysis", "reading_explanation", "topic_generation"],
      },

      // Cerebras Inference Models (Ultra-Fast Free Tier)
      {
        provider: "cerebras",
        modelId: "llama3.1-8b",
        displayName: "Cerebras Llama 3.1 8B",
        isFree: true,
        contextLength: 8192,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "supported",
          vision: "unsupported",
        },
        status: "active",
        qualityProfile: {
          schemaReliability: 0.90,
          grammarPrecision: 0.82,
          grammarRecall: 0.80,
          falsePositiveRate: 0.18,
          naturalnessAccuracy: 0.82,
          dialectHandling: 0.80,
          spokenLanguageHandling: 0.82,
          confidenceCalibration: 0.85,
          linguisticQuality: "acceptable",
          reasoningCapability: "medium",
          structuredOutputReliability: 0.90,
          latencyClass: "ultra_fast",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: ["conversation", "reading_explanation", "listening_explanation", "topic_generation"],
      },

      // OpenRouter Free Models
      {
        provider: "openrouter",
        modelId: "openrouter/free",
        displayName: "OpenRouter Auto-Free Router",
        isFree: true,
        contextLength: 131072,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "supported",
          vision: "supported",
        },
        status: "active",
        linguisticQualityStatus: "safe_for_primary",
        qualityProfile: {
          schemaReliability: 0.93,
          grammarPrecision: 1.0,
          grammarRecall: 1.0,
          falsePositiveRate: 0.0,
          naturalnessAccuracy: 0.95,
          dialectHandling: 0.92,
          spokenLanguageHandling: 0.90,
          confidenceCalibration: 0.95,
          linguisticQuality: "acceptable",
          reasoningCapability: "high",
          structuredOutputReliability: 0.93,
          latencyClass: "moderate",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: [
          "conversation",
          "vocabulary_analysis",
          "writing_analysis",
          "lesson_generation",
          "reading_explanation",
          "listening_explanation",
          "topic_generation",
        ],
      },

      // Local Ollama Provider (Marked Unsafe for Primary Linguistic Analysis)
      {
        provider: "local",
        modelId: "llama3.2:1b",
        displayName: "Local Llama 3.2 1B Instruct",
        isFree: true,
        contextLength: 4096,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "supported",
          vision: "unsupported",
        },
        status: "active",
        linguisticQualityStatus: "unsafe_for_primary_linguistic_analysis",
        qualityProfile: {
          schemaReliability: 1.0,
          grammarPrecision: 0.417,
          grammarRecall: 0.357,
          falsePositiveRate: 0.438,
          naturalnessAccuracy: 0.5,
          dialectHandling: 0.5,
          spokenLanguageHandling: 0.6,
          confidenceCalibration: 0.45,
          linguisticQuality: "unsafe",
          reasoningCapability: "low",
          structuredOutputReliability: 1.0,
          latencyClass: "fast",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: ["conversation", "grammar_analysis", "topic_generation"],
      },
      {
        provider: "local",
        modelId: "phi3:latest",
        displayName: "Local Phi-3 Mini",
        isFree: true,
        contextLength: 4096,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "unknown",
          vision: "unsupported",
        },
        status: "active",
        linguisticQualityStatus: "unsafe_for_primary_linguistic_analysis",
        qualityProfile: {
          schemaReliability: 0.90,
          grammarPrecision: 0.45,
          grammarRecall: 0.40,
          falsePositiveRate: 0.40,
          naturalnessAccuracy: 0.5,
          dialectHandling: 0.5,
          spokenLanguageHandling: 0.5,
          confidenceCalibration: 0.5,
          linguisticQuality: "unsafe",
          reasoningCapability: "low",
          structuredOutputReliability: 0.90,
          latencyClass: "fast",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: ["conversation", "topic_generation"],
      },

      // Deterministic Mock Provider (For Unit & Integration Testing)
      {
        provider: "mock",
        modelId: "mock-llm-v1",
        displayName: "Deterministic Test Mock",
        isFree: true,
        contextLength: 100000,
        capabilities: {
          streaming: "supported",
          structuredOutput: "supported",
          reasoning: "supported",
          vision: "supported",
        },
        status: "active",
        linguisticQualityStatus: "safe_for_primary",
        qualityProfile: {
          schemaReliability: 1.0,
          grammarPrecision: 0.95,
          grammarRecall: 0.95,
          falsePositiveRate: 0.0,
          naturalnessAccuracy: 1.0,
          dialectHandling: 1.0,
          spokenLanguageHandling: 1.0,
          confidenceCalibration: 1.0,
          linguisticQuality: "trusted",
          reasoningCapability: "high",
          structuredOutputReliability: 1.0,
          latencyClass: "ultra_fast",
          availability: "high",
          costClass: "free",
        },
        intendedTasks: [
          "conversation",
          "grammar_analysis",
          "vocabulary_analysis",
          "writing_analysis",
          "error_classification",
          "lesson_generation",
          "deep_analysis",
          "reading_explanation",
          "listening_explanation",
          "topic_generation",
        ],
      },
    ];

    for (const model of defaultModels) {
      this.registerModel(model);
    }
  }

  public registerModel(metadata: ModelMetadata): void {
    const key = `${metadata.provider}:${metadata.modelId}`;
    this.models.set(key, Object.freeze({ ...metadata }));
  }

  public getModel(provider: ProviderType, modelId: string): ModelMetadata | undefined {
    return this.models.get(`${provider}:${modelId}`);
  }

  public getModelsForTask(task: LLMTaskType, freeOnly: boolean = true): readonly ModelMetadata[] {
    return Array.from(this.models.values()).filter((model) => {
      if (model.status !== "active") return false;
      if (freeOnly && !model.isFree) return false;
      if (
        (task === "grammar_analysis" || task === "writing_analysis" || task === "error_classification") &&
        model.linguisticQualityStatus === "unsafe_for_primary_linguistic_analysis"
      ) {
        return false;
      }
      return model.intendedTasks.includes(task);
    });
  }

  /**
   * Risk-aware capability matcher returning candidates and rejected models with explicit rejection reasons.
   */
  public getCandidatesForRequirementProfile(
    taskProfile: TaskRequirementProfile,
    freeOnly: boolean = true
  ): {
    candidates: ModelMetadata[];
    rejected: Array<{ modelId: string; reason: string }>;
  } {
    const candidates: ModelMetadata[] = [];
    const rejected: Array<{ modelId: string; reason: string }> = [];

    if (taskProfile.riskLevel === "DETERMINISTIC") {
      return { candidates: [], rejected: [{ modelId: "all_llm_models", reason: "Deterministic task prohibits LLM execution." }] };
    }

    for (const model of this.models.values()) {
      const modelKey = `${model.provider}:${model.modelId}`;

      if (model.status !== "active") {
        rejected.push({ modelId: modelKey, reason: `Model status is ${model.status}` });
        continue;
      }

      if (freeOnly && !model.isFree) {
        rejected.push({ modelId: modelKey, reason: "Free-only policy active and model is paid" });
        continue;
      }

      // Check Task Intended Eligibility
      if (!model.intendedTasks.includes(taskProfile.taskType)) {
        rejected.push({ modelId: modelKey, reason: `Model not configured for task '${taskProfile.taskType}'` });
        continue;
      }

      // Structured Output Check
      if (taskProfile.requiresStructuredOutput && model.capabilities.structuredOutput === "unsupported") {
        rejected.push({ modelId: modelKey, reason: "Task requires structured output but model capabilities mark unsupported" });
        continue;
      }

      // Unsafe Model Protection Gate
      if (
        model.linguisticQualityStatus === "unsafe_for_primary_linguistic_analysis" ||
        model.qualityProfile?.linguisticQuality === "unsafe"
      ) {
        if (taskProfile.affectsLearningState || taskProfile.riskLevel === "CRITICAL" || taskProfile.riskLevel === "HIGH") {
          rejected.push({
            modelId: modelKey,
            reason: `Model is UNSAFE_FOR_PRIMARY_LINGUISTIC_ANALYSIS and cannot handle ${taskProfile.riskLevel} risk task that affects learning state.`,
          });
          continue;
        }
      }

      // Minimum Quality Threshold Matching
      if (taskProfile.minimumLinguisticQuality === "trusted") {
        const isTrustedStatus = model.linguisticQualityStatus === "safe_for_primary" || model.qualityProfile?.linguisticQuality === "trusted";
        if (!isTrustedStatus) {
          rejected.push({
            modelId: modelKey,
            reason: `Task requires minimum linguistic quality 'trusted', but model quality is '${model.qualityProfile?.linguisticQuality ?? model.linguisticQualityStatus ?? "unknown"}'.`,
          });
          continue;
        }
      }

      candidates.push(model);
    }

    return { candidates, rejected };
  }

  public getAllModels(): readonly ModelMetadata[] {
    return Array.from(this.models.values());
  }
}

export const modelRegistry = new ModelRegistry();
