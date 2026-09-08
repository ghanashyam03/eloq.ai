import { z } from "zod";
import { LLMTaskType } from "./model-task.types";

export const TaskRiskLevelSchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "DETERMINISTIC",
]);

export type TaskRiskLevel = z.infer<typeof TaskRiskLevelSchema>;

export interface TaskRequirementProfile {
  taskType: LLMTaskType;
  riskLevel: TaskRiskLevel;
  minimumLinguisticQuality: "trusted" | "acceptable" | "experimental";
  requiresHighPrecision: boolean;
  affectsLearningState: boolean;
  dialectSensitive: boolean;
  naturalnessSensitive: boolean;
  requiresStructuredOutput: boolean;
  latencySensitivity: "high" | "medium" | "low";
  canUseFreeRouter: boolean;
  canUseFallback: boolean;
  escalationAllowed: boolean;
  description: string;
}

/**
 * Task Requirement Profiles Registry mapping every task type to explicit, typed risk and quality constraints.
 */
export const TASK_REQUIREMENT_PROFILES: Readonly<Record<LLMTaskType, TaskRequirementProfile>> = Object.freeze({
  grammar_analysis: {
    taskType: "grammar_analysis",
    riskLevel: "CRITICAL",
    minimumLinguisticQuality: "trusted",
    requiresHighPrecision: true,
    affectsLearningState: true,
    dialectSensitive: true,
    naturalnessSensitive: true,
    requiresStructuredOutput: true,
    latencySensitivity: "medium",
    canUseFreeRouter: false, // Critical learning task requires verified models, not unknown free routers
    canUseFallback: true,
    escalationAllowed: true,
    description: "Evaluates learner grammar, surfaces errors, and directly updates recurring weakness queues and skill mastery.",
  },
  writing_analysis: {
    taskType: "writing_analysis",
    riskLevel: "HIGH",
    minimumLinguisticQuality: "trusted",
    requiresHighPrecision: true,
    affectsLearningState: true,
    dialectSensitive: true,
    naturalnessSensitive: true,
    requiresStructuredOutput: true,
    latencySensitivity: "low",
    canUseFreeRouter: true,
    canUseFallback: true,
    escalationAllowed: true,
    description: "Comprehensive writing critique, tone analysis, and structural feedback affecting user skill profile.",
  },
  error_classification: {
    taskType: "error_classification",
    riskLevel: "HIGH",
    minimumLinguisticQuality: "trusted",
    requiresHighPrecision: true,
    affectsLearningState: true,
    dialectSensitive: true,
    naturalnessSensitive: false,
    requiresStructuredOutput: true,
    latencySensitivity: "high",
    canUseFreeRouter: false,
    canUseFallback: true,
    escalationAllowed: true,
    description: "Categorizes error taxonomy for recurring weakness tracking.",
  },
  deep_analysis: {
    taskType: "deep_analysis",
    riskLevel: "HIGH",
    minimumLinguisticQuality: "trusted",
    requiresHighPrecision: true,
    affectsLearningState: true,
    dialectSensitive: true,
    naturalnessSensitive: true,
    requiresStructuredOutput: true,
    latencySensitivity: "low",
    canUseFreeRouter: true,
    canUseFallback: true,
    escalationAllowed: true,
    description: "In-depth diagnostic evaluation of user language proficiency.",
  },
  vocabulary_analysis: {
    taskType: "vocabulary_analysis",
    riskLevel: "MEDIUM",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: false,
    affectsLearningState: true,
    dialectSensitive: false,
    naturalnessSensitive: true,
    requiresStructuredOutput: true,
    latencySensitivity: "high",
    canUseFreeRouter: true,
    canUseFallback: true,
    escalationAllowed: false,
    description: "Identifies active vocabulary encounters and suggests idiomatic upgrades.",
  },
  conversation: {
    taskType: "conversation",
    riskLevel: "MEDIUM",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: false,
    affectsLearningState: false,
    dialectSensitive: false,
    naturalnessSensitive: true,
    requiresStructuredOutput: false,
    latencySensitivity: "high",
    canUseFreeRouter: true,
    canUseFallback: true,
    escalationAllowed: false,
    description: "Generates spoken interactive tutor dialogue turns.",
  },
  lesson_generation: {
    taskType: "lesson_generation",
    riskLevel: "MEDIUM",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: false,
    affectsLearningState: false,
    dialectSensitive: false,
    naturalnessSensitive: true,
    requiresStructuredOutput: true,
    latencySensitivity: "medium",
    canUseFreeRouter: true,
    canUseFallback: true,
    escalationAllowed: false,
    description: "Generates targeted curriculum exercises based on user skill gaps.",
  },
  reading_explanation: {
    taskType: "reading_explanation",
    riskLevel: "LOW",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: false,
    affectsLearningState: false,
    dialectSensitive: false,
    naturalnessSensitive: false,
    requiresStructuredOutput: false,
    latencySensitivity: "high",
    canUseFreeRouter: true,
    canUseFallback: true,
    escalationAllowed: false,
    description: "Provides contextual explanations for reading comprehension passages.",
  },
  listening_explanation: {
    taskType: "listening_explanation",
    riskLevel: "LOW",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: false,
    affectsLearningState: false,
    dialectSensitive: false,
    naturalnessSensitive: false,
    requiresStructuredOutput: false,
    latencySensitivity: "high",
    canUseFreeRouter: true,
    canUseFallback: true,
    escalationAllowed: false,
    description: "Explains spoken audio transcripts and phonological variations.",
  },
  topic_generation: {
    taskType: "topic_generation",
    riskLevel: "LOW",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: false,
    affectsLearningState: false,
    dialectSensitive: false,
    naturalnessSensitive: false,
    requiresStructuredOutput: false,
    latencySensitivity: "high",
    canUseFreeRouter: true,
    canUseFallback: true,
    escalationAllowed: false,
    description: "Brainstorming conversation practice topics and prompts.",
  },
  progress_calculation: {
    taskType: "progress_calculation",
    riskLevel: "DETERMINISTIC",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: true,
    affectsLearningState: true,
    dialectSensitive: false,
    naturalnessSensitive: false,
    requiresStructuredOutput: false,
    latencySensitivity: "high",
    canUseFreeRouter: false,
    canUseFallback: false,
    escalationAllowed: false,
    description: "Calculates overall proficiency progress scores from historical attempts deterministically.",
  },
  fluency_calculation: {
    taskType: "fluency_calculation",
    riskLevel: "DETERMINISTIC",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: true,
    affectsLearningState: true,
    dialectSensitive: false,
    naturalnessSensitive: false,
    requiresStructuredOutput: false,
    latencySensitivity: "high",
    canUseFreeRouter: false,
    canUseFallback: false,
    escalationAllowed: false,
    description: "Calculates WPM, pause ratios, and filler density deterministically without LLM.",
  },
  mastery_calculation: {
    taskType: "mastery_calculation",
    riskLevel: "DETERMINISTIC",
    minimumLinguisticQuality: "acceptable",
    requiresHighPrecision: true,
    affectsLearningState: true,
    dialectSensitive: false,
    naturalnessSensitive: false,
    requiresStructuredOutput: false,
    latencySensitivity: "high",
    canUseFreeRouter: false,
    canUseFallback: false,
    escalationAllowed: false,
    description: "Computes skill mastery scores and SRS review intervals deterministically.",
  },
});

export function getTaskRequirementProfile(taskType: LLMTaskType): TaskRequirementProfile {
  const profile = TASK_REQUIREMENT_PROFILES[taskType];
  if (!profile) {
    // Default safe profile for unlisted task types
    return {
      taskType,
      riskLevel: "HIGH",
      minimumLinguisticQuality: "trusted",
      requiresHighPrecision: true,
      affectsLearningState: false,
      dialectSensitive: false,
      naturalnessSensitive: false,
      requiresStructuredOutput: false,
      latencySensitivity: "medium",
      canUseFreeRouter: false,
      canUseFallback: true,
      escalationAllowed: true,
      description: "Default fallback requirement profile for unlisted task types.",
    };
  }
  return profile;
}
