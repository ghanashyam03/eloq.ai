import { z } from "zod";

export const LLMTaskTypeSchema = z.enum([
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
  "progress_calculation",
  "fluency_calculation",
  "mastery_calculation",
]);

export type LLMTaskType = z.infer<typeof LLMTaskTypeSchema>;

export type ProviderType =
  | "gemini"
  | "nvidia"
  | "huggingface"
  | "cerebras"
  | "openrouter"
  | "openai-compatible"
  | "local"
  | "mock";

export type TriStateCapability = "supported" | "unsupported" | "unknown";

export type LinguisticQualityStatus =
  | "safe_for_primary"
  | "unsafe_for_primary_linguistic_analysis"
  | "experimental"
  | "untested";

export interface ModelQualityProfile {
  schemaReliability: number; // 0.0 to 1.0
  grammarPrecision: number;
  grammarRecall: number;
  falsePositiveRate: number;
  naturalnessAccuracy: number;
  dialectHandling: number;
  spokenLanguageHandling: number;
  confidenceCalibration: number;
  linguisticQuality?: "trusted" | "acceptable" | "experimental" | "unsafe";
  reasoningCapability?: "high" | "medium" | "low";
  structuredOutputReliability?: number;
  latencyClass?: "ultra_fast" | "fast" | "moderate" | "slow";
  availability?: "high" | "medium" | "low";
  costClass?: "free" | "low" | "medium" | "high";
}

export interface ModelMetadata {
  provider: ProviderType;
  modelId: string;
  displayName: string;
  isFree: boolean;
  contextLength?: number;
  capabilities: {
    streaming: TriStateCapability;
    structuredOutput: TriStateCapability;
    reasoning: TriStateCapability;
    vision: TriStateCapability;
  };
  status: "active" | "degraded" | "disabled";
  linguisticQualityStatus?: LinguisticQualityStatus;
  qualityProfile?: ModelQualityProfile;
  intendedTasks: readonly LLMTaskType[];
}

export interface RoutingDecision {
  taskType: LLMTaskType;
  riskLevel: import("./task-risk-taxonomy").TaskRiskLevel;
  requiredCapabilities: import("./task-risk-taxonomy").TaskRequirementProfile;
  candidateModels: string[];
  rejectedCandidates: Array<{ modelId: string; reason: string }>;
  selectedProvider: ProviderType;
  selectedRouterModel: string;
  selectedUnderlyingModel: string;
  selectionReason: string;
  escalationAllowed: boolean;
  escalationTriggered?: boolean;
  escalationReason?: string;
  fallbackPolicy: string;
  qualityStatus: LinguisticQualityStatus;
  timestamp: string;
}
