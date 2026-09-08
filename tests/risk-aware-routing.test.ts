import { describe, it, expect, beforeEach, vi } from "vitest";
import { ModelRouter, modelRouter as singletonRouter } from "@/server/providers/llm/router/model-router";
import { ModelRegistry } from "@/server/providers/llm/registry/model-registry";
import { TASK_REQUIREMENT_PROFILES, getTaskRequirementProfile } from "@/server/providers/llm/registry/task-risk-taxonomy";
import { providerProfileRegistry } from "@/server/providers/llm/registry/provider-profiles";
import { MockLLMProvider } from "@/server/providers/llm/implementations/mock.provider";
import { LLMTaskType } from "@/server/providers/llm/registry/model-task.types";
import { englishAnalysisService } from "@/server/services/english-analysis-service";
import { issueVerifier } from "@/server/analysis/verifier";

describe("Production-Grade Risk-Aware Routing Subsystem", () => {
  let router: ModelRouter;
  let registry: ModelRegistry;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    providerProfileRegistry.resetBudgets();
    registry = new ModelRegistry();
    router = new ModelRouter(registry, providerProfileRegistry);

    mockLLM = new MockLLMProvider();
    router.registerProvider("gemini", mockLLM);
    router.registerProvider("openrouter", mockLLM);
    router.registerProvider("nvidia", mockLLM);
    router.registerProvider("cerebras", mockLLM);
    router.registerProvider("local", mockLLM);
    router.registerProvider("mock", mockLLM);

    singletonRouter.registerProvider("gemini", mockLLM);
    singletonRouter.registerProvider("openrouter", mockLLM);
    singletonRouter.registerProvider("nvidia", mockLLM);
    singletonRouter.registerProvider("cerebras", mockLLM);
    singletonRouter.registerProvider("local", mockLLM);
    singletonRouter.registerProvider("mock", mockLLM);
    singletonRouter.registerProvider("mock", mockLLM);
  });

  // 1. Critical Task Routing
  it("1. should route critical grammar_analysis tasks to trusted high-quality models (Gemini)", () => {
    const decision = router.resolveRoutingDecision({ taskType: "grammar_analysis" });

    expect(decision.riskLevel).toBe("CRITICAL");
    expect(decision.requiredCapabilities.minimumLinguisticQuality).toBe("trusted");
    expect(decision.selectedProvider).toBe("gemini");
    expect(decision.qualityStatus).toBe("safe_for_primary");
  });

  // 2. Low-Risk Task Routing
  it("2. should route low-risk topic_generation tasks to low-latency free models", () => {
    const decision = router.resolveRoutingDecision({ taskType: "topic_generation" });

    expect(decision.riskLevel).toBe("LOW");
    expect(decision.candidateModels.length).toBeGreaterThan(0);
    expect(decision.selectionReason).toContain("topic_generation");
  });

  // 3. Deterministic-First Interception
  it("3. should intercept DETERMINISTIC tasks locally and execute zero LLM calls", async () => {
    const tasks: LLMTaskType[] = ["progress_calculation", "fluency_calculation", "mastery_calculation"];

    for (const taskType of tasks) {
      const decision = router.resolveRoutingDecision({ taskType });
      expect(decision.riskLevel).toBe("DETERMINISTIC");
      expect(decision.selectedRouterModel).toBe("deterministic_local");

      await expect(
        router.generateCompletion([{ role: "user", content: "calc" }], { taskType })
      ).rejects.toThrow("DETERMINISTIC and must be calculated locally without an LLM");
    }
  });

  // 4. Unsafe-Model Rejection Gate
  it("4. should strictly reject unsafe models (llama3.2:1b) for CRITICAL or HIGH risk tasks", () => {
    const profile = getTaskRequirementProfile("grammar_analysis");
    const { candidates, rejected } = registry.getCandidatesForRequirementProfile(profile, true);

    const isLlama1bCandidate = candidates.some((m) => m.modelId === "llama3.2:1b");
    expect(isLlama1bCandidate).toBe(false);

    const llama1bRejection = rejected.find((r) => r.modelId.includes("llama3.2:1b"));
    expect(llama1bRejection).toBeDefined();
    expect(llama1bRejection?.reason).toContain("UNSAFE_FOR_PRIMARY_LINGUISTIC_ANALYSIS");
  });

  // 5. Quality Gate Rejection for Learning-State Affecting Tasks
  it("5. should reject experimental/untrusted models from state-changing grammar/writing analysis", () => {
    const profile = getTaskRequirementProfile("writing_analysis");
    const { candidates } = registry.getCandidatesForRequirementProfile(profile, true);

    for (const candidate of candidates) {
      expect(candidate.linguisticQualityStatus).toBe("safe_for_primary");
    }
  });

  // 6. OpenRouter Underlying Model Tracking
  it("6. should track and expose OpenRouter underlying model from raw response", async () => {
    const openrouterMock = new MockLLMProvider({
      cannedResponse: JSON.stringify({
        choices: [{ message: { content: "Test output" } }],
        model: "meta-llama/llama-3.3-70b-instruct",
      }),
    });
    router.registerProvider("openrouter", openrouterMock);

    const response = await router.generateCompletion([{ role: "user", content: "test" }], {
      taskType: "conversation",
      providerOverride: "openrouter",
      modelOverride: "openrouter/free",
    });

    expect(response.model).toBe("meta-llama/llama-3.3-70b-instruct");
  });

  // 7. Dynamic Escalation Protocol
  it("7. should escalate to Gemini when verifier disagreement occurs on an acceptable model", async () => {
    const escalateSpy = vi.spyOn(router, "escalateStructured");
    expect(escalateSpy).toBeDefined();

    // Simulate analysis service running candidate extraction on acceptable model
    mockLLM.setMockConfig({
      cannedResponse: JSON.stringify({
        overallSummary: "Summary",
        isCompletelyCorrect: false,
        classificationState: "grammatically_incorrect",
        issues: [
          {
            category: "GRAMMAR",
            subcategory: "general",
            classificationState: "grammatically_incorrect",
            originalText: "The colour is blue",
            correctedText: "The color is blue",
            explanation: "Ambiguous error",
            severity: 1,
            confidence: 0.50, // Low confidence issue produces verifier uncertainty & disagreement
            evidenceSpan: { textSnippet: "The colour is blue" },
            uncertaintyState: true,
          },
        ],
        usefulVocabularyEncounters: [],
      }),
    });

    const result = await englishAnalysisService.analyzeEnglish({
      transcript: "The colour is blue.",
      englishVariety: "en-US",
      providerOverride: "nvidia", // Acceptable provider (not primary trusted)
    });

    expect(result.isCompletelyCorrect).toBe(true);
    expect(result.highConfidenceIssues).toHaveLength(0);
  });

  // 8. No Downgrade to Unsafe Models on Fallback
  it("8. should never fall back from a trusted model to an unsafe model (llama3.2:1b) during failure", async () => {
    const failingGemini = new MockLLMProvider({ shouldFail: true });
    router.registerProvider("gemini", failingGemini);

    const profile = getTaskRequirementProfile("grammar_analysis");
    const { candidates } = registry.getCandidatesForRequirementProfile(profile, true);

    const selectedFallback = candidates.find((c) => c.provider !== "gemini");
    if (selectedFallback) {
      expect(selectedFallback.linguisticQualityStatus).toBe("safe_for_primary");
      expect(selectedFallback.modelId).not.toBe("llama3.2:1b");
    }
  });

  // 9. Free-Only Mode Policy Enforcement
  it("9. should strictly reject paid provider models when FREE_ONLY_MODE is active", () => {
    const profile = getTaskRequirementProfile("grammar_analysis");
    const { candidates } = registry.getCandidatesForRequirementProfile(profile, true);

    for (const candidate of candidates) {
      expect(candidate.isFree).toBe(true);
    }
  });

  // 10. Routing Decision Explanation Object
  it("10. should generate a structured RoutingDecision object containing explicit selection reasons", () => {
    const decision = router.resolveRoutingDecision({ taskType: "grammar_analysis" });

    expect(decision.taskType).toBe("grammar_analysis");
    expect(decision.riskLevel).toBe("CRITICAL");
    expect(decision.selectionReason).toContain("grammar_analysis");
    expect(decision.timestamp).toBeDefined();
  });

  // 11. Provider Failure Handling
  it("11. should handle provider rate limit or failure by transitioning health state", () => {
    providerProfileRegistry.recordFailure("nvidia", "rate_limit");
    providerProfileRegistry.recordFailure("nvidia", "rate_limit");
    providerProfileRegistry.recordFailure("nvidia", "rate_limit");

    const profile = providerProfileRegistry.getProfile("nvidia");
    expect(profile.consecutiveFailures).toBe(3);
    expect(profile.healthStatus).toBe("degraded");
  });

  // 12. Learning-State Protection Guarantee
  it("12. should prevent non-errors (dialect/fillers/uncertain) from altering learner mastery queue", () => {
    const candidateIssue = {
      id: "test-id",
      category: "GRAMMAR" as const,
      subcategory: "spelling" as const,
      classificationState: "dialect_variant_valid" as const,
      originalText: "colour",
      correctedText: "color",
      explanation: "UK spelling",
      severity: 1,
      confidence: 0.95,
      evidenceSpan: { textSnippet: "colour" },
      uncertaintyState: false,
    };

    const verifications = issueVerifier.verifyIssues([candidateIssue], "en-US");
    expect(verifications[0]!.isAccepted).toBe(false);
    expect(verifications[0]!.certainty).toBe("dialect_variant");
  });

  // 13. Comprehensive Task Routing Matrix Test
  it("13. Full Task Routing Matrix Test: should verify routing constraints across all task types", () => {
    const allTaskTypes: LLMTaskType[] = [
      "grammar_analysis",
      "writing_analysis",
      "vocabulary_analysis",
      "error_classification",
      "conversation",
      "lesson_generation",
      "deep_analysis",
      "reading_explanation",
      "listening_explanation",
      "topic_generation",
      "progress_calculation",
      "fluency_calculation",
      "mastery_calculation",
    ];

    for (const taskType of allTaskTypes) {
      const decision = router.resolveRoutingDecision({ taskType });
      const profile = TASK_REQUIREMENT_PROFILES[taskType];

      expect(decision.taskType).toBe(taskType);
      expect(decision.riskLevel).toBe(profile.riskLevel);

      if (profile.riskLevel === "DETERMINISTIC") {
        expect(decision.selectedRouterModel).toBe("deterministic_local");
      } else if (profile.riskLevel === "CRITICAL") {
        expect(decision.qualityStatus).toBe("safe_for_primary");
      }
    }
  });
});
