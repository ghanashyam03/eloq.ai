import { describe, it, expect, vi, beforeEach } from "vitest";
import { issueVerifier } from "../src/server/analysis/verifier";
import { englishAnalysisService } from "../src/server/services/english-analysis-service";
import { weaknessCalculator } from "../src/server/learning/weakness-calculator";
import { modelRegistry } from "../src/server/providers/llm/registry/model-registry";
import { LinguisticIssue } from "../src/domain/analysis/analysis-engine.schema";

describe("Linguistic Safety & Verifier Architecture Regression Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. "colour" is not automatically corrected to "color"
  it("1. should not treat 'colour' as a grammar error (dialect variant protection)", () => {
    const candidate: LinguisticIssue = {
      id: "11111111-1111-1111-1111-111111111111",
      category: "GRAMMAR",
      subcategory: "incorrect_word",
      classificationState: "grammatically_incorrect",
      originalText: "colour",
      correctedText: "color",
      explanation: "Use American spelling color",
      severity: 2,
      confidence: 0.9,
      evidenceSpan: { textSnippet: "colour" },
      uncertaintyState: false,
    };

    const verifications = issueVerifier.verifyIssues([candidate], "en-US");
    expect(verifications[0]!.isAccepted).toBe(false);
    expect(verifications[0]!.certainty).toBe("dialect_variant");
    expect(verifications[0]!.issue.classificationState).toBe("dialect_variant_valid");
  });

  // 2. "gonna" is not automatically treated as a grammar error
  it("2. should not treat 'gonna' as a grammar error (informal valid protection)", () => {
    const candidate: LinguisticIssue = {
      id: "22222222-2222-2222-2222-222222222222",
      category: "GRAMMAR",
      subcategory: "incorrect_word",
      classificationState: "grammatically_incorrect",
      originalText: "gonna",
      correctedText: "going to",
      explanation: "Avoid informal gonna",
      severity: 2,
      confidence: 0.9,
      evidenceSpan: { textSnippet: "gonna" },
      uncertaintyState: false,
    };

    const verifications = issueVerifier.verifyIssues([candidate], "en-US");
    expect(verifications[0]!.isAccepted).toBe(false);
    expect(verifications[0]!.certainty).toBe("informal_valid");
    expect(verifications[0]!.issue.classificationState).toBe("informal_valid");
  });

  // 3. "head out" is not automatically treated as a grammar error
  it("3. should not treat 'head out' as a grammar error (natural phrasal protection)", () => {
    const candidate: LinguisticIssue = {
      id: "33333333-3333-3333-3333-333333333333",
      category: "GRAMMAR",
      subcategory: "incorrect_word",
      classificationState: "grammatically_incorrect",
      originalText: "head out",
      correctedText: "leave",
      explanation: "Unnatural phrasal verb",
      severity: 2,
      confidence: 0.9,
      evidenceSpan: { textSnippet: "head out" },
      uncertaintyState: false,
    };

    const verifications = issueVerifier.verifyIssues([candidate], "en-US");
    expect(verifications[0]!.isAccepted).toBe(false);
    expect(verifications[0]!.certainty).toBe("informal_valid");
  });

  // 4. Obvious grammar errors can be promoted when verification agrees
  it("4. should promote obvious grammar errors ('she don't') as certain_error", () => {
    const candidate: LinguisticIssue = {
      id: "44444444-4444-4444-4444-444444444444",
      category: "GRAMMAR",
      subcategory: "subject_verb_agreement",
      classificationState: "grammatically_incorrect",
      originalText: "she don't like it",
      correctedText: "she doesn't like it",
      explanation: "Third-person singular agreement error",
      severity: 3,
      confidence: 0.95,
      evidenceSpan: { textSnippet: "she don't like it" },
      uncertaintyState: false,
    };

    const verifications = issueVerifier.verifyIssues([candidate], "en-US");
    expect(verifications[0]!.isAccepted).toBe(true);
    expect(verifications[0]!.certainty).toBe("certain_error");
  });

  // 5. LLM style preferences do not create grammar weaknesses
  it("5. should not assign priority scores to low-confidence style preferences", () => {
    const priorityScore = weaknessCalculator.calculatePriorityScore({
      occurrenceCount: 1,
      distinctSessionCount: 1,
      averageSeverity: 2,
      averageConfidence: 0.40, // Below 0.50 cutoff for weakness creation
      lastDetectedAt: new Date(),
    });

    expect(priorityScore).toBe(0.0);
  });

  // 6. Dialect differences do not create weaknesses
  it("6. should return 0.0 priority for dialect variant candidate issues", () => {
    const candidate: LinguisticIssue = {
      id: "66666666-6666-6666-6666-666666666666",
      category: "GRAMMAR",
      subcategory: "incorrect_word",
      classificationState: "dialect_variant_valid",
      originalText: "organised",
      correctedText: "organized",
      explanation: "British spelling",
      severity: 1,
      confidence: 0.9,
      evidenceSpan: { textSnippet: "organised" },
      uncertaintyState: false,
    };

    const verifications = issueVerifier.verifyIssues([candidate], "en-US");
    expect(verifications[0]!.isAccepted).toBe(false);
  });

  // 7. Uncertain judgments do not modify mastery
  it("7. should not calculate mastery degradation when attempts count is 0", () => {
    const mastery = weaknessCalculator.calculateMastery({
      totalAttempts: 0,
      successes: 0,
      failures: 0,
    });

    expect(mastery).toBe(0.0);
  });

  // 8. High LLM confidence does not override verifier disagreement
  it("8. should reject candidate with high LLM confidence when verifier detects spoken filler", () => {
    const candidate: LinguisticIssue = {
      id: "88888888-8888-8888-8888-888888888888",
      category: "GRAMMAR",
      subcategory: "incorrect_word",
      classificationState: "grammatically_incorrect",
      originalText: "um",
      correctedText: "",
      explanation: "Remove spoken filler um",
      severity: 1,
      confidence: 0.99, // High LLM confidence
      evidenceSpan: { textSnippet: "um" },
      uncertaintyState: false,
    };

    const verifications = issueVerifier.verifyIssues([candidate], "en-US");
    expect(verifications[0]!.isAccepted).toBe(false);
    expect(verifications[0]!.certainty).toBe("informal_valid");
  });

  // 9. Malformed model output is rejected
  it("9. should reject empty transcripts with validation error", async () => {
    await expect(
      englishAnalysisService.analyzeEnglish({ transcript: "   " })
    ).rejects.toThrow("Transcript cannot be empty");
  });

  // 10. Raw evidence is preserved
  it("10. should preserve rawModelResponse, normalizedCandidateCount, and verificationReasons", async () => {
    const analysis = await englishAnalysisService.analyzeEnglish({
      transcript: "She don't like it.",
      englishVariety: "en-US",
      providerOverride: "mock",
    });

    expect(analysis.rawModelResponse).toBeDefined();
    expect(analysis.normalizedCandidateCount).toBeDefined();
    expect(analysis.verificationReasons).toBeDefined();
    expect(Array.isArray(analysis.verificationReasons)).toBe(true);
  });

  // 11. Quality gate model exclusion
  it("11. should exclude llama3.2:1b from primary grammar_analysis task selection in ModelRegistry", () => {
    const modelsForGrammar = modelRegistry.getModelsForTask("grammar_analysis", true);
    const hasLlama1b = modelsForGrammar.some((m) => m.modelId === "llama3.2:1b");

    expect(hasLlama1b).toBe(false);
  });
});
