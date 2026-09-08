import { describe, it, expect, beforeEach, vi } from "vitest";
import { EnglishAnalysisService } from "@/server/services/english-analysis-service";
import { ModelRouter } from "@/server/providers/llm/router/model-router";
import { MockLLMProvider } from "@/server/providers/llm/implementations/mock.provider";
import { deterministicAnalyzer } from "@/server/analysis/deterministic-analyzer";
import { issueVerifier } from "@/server/analysis/verifier";

describe("English Analysis Service & Deterministic Analytics", () => {
  let analysisService: EnglishAnalysisService;
  let mockRouter: ModelRouter;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockRouter = new ModelRouter();
    mockLLM = new MockLLMProvider();
    mockRouter.registerProvider("gemini", mockLLM);
    mockRouter.registerProvider("huggingface", mockLLM);

    analysisService = new EnglishAnalysisService(mockRouter, deterministicAnalyzer, issueVerifier);
  });

  it("should calculate word count, sentence count, TTR, and filler tokens purely deterministically", () => {
    const text = "Um, well, I went to the market, you know, and like bought three apples.";
    const stats = deterministicAnalyzer.analyzeText(text, { durationSeconds: 10, pauseCount: 2, totalPauseSecs: 3 });

    expect(stats.wordCount).toBe(14);
    expect(stats.sentenceCount).toBe(1);
    expect(stats.typeTokenRatio).toBeGreaterThan(0);
    expect(stats.fillerCount).toBeGreaterThanOrEqual(2); // "um", "like", "you know"
    expect(stats.wordsPerMinute).toBe(84); // (14 / 10) * 60
  });

  it("should evaluate a completely correct sentence and return no high-confidence issues", async () => {
    mockLLM.setMockConfig({
      cannedResponse: JSON.stringify({
        overallSummary: "No significant issues detected.",
        isCompletelyCorrect: true,
        classificationState: "grammatically_correct_and_natural",
        issues: [],
        usefulVocabularyEncounters: [],
      }),
    });

    const result = await analysisService.analyzeEnglish({
      transcript: "I went to the university yesterday and met my professor.",
    });

    expect(result.isCompletelyCorrect).toBe(true);
    expect(result.highConfidenceIssues).toHaveLength(0);
    expect(result.classificationState).toBe("grammatically_correct_and_natural");
  });

  it("should categorize unnatural phrasing under NATURALNESS rather than GRAMMAR errors", async () => {
    mockLLM.setMockConfig({
      cannedResponse: JSON.stringify({
        overallSummary: "Phrase is unnatural.",
        isCompletelyCorrect: false,
        classificationState: "unnatural_phrase",
        issues: [
          {
            category: "NATURALNESS",
            subcategory: "awkward_phrase",
            classificationState: "unnatural_phrase",
            originalText: "having a doubt",
            correctedText: "have a question",
            naturalAlternative: "I have a question.",
            explanation: "'having a doubt' is non-idiomatic in standard English.",
            severity: 2,
            confidence: 0.90,
            evidenceSpan: { textSnippet: "having a doubt" },
            uncertaintyState: false,
          },
        ],
      }),
    });

    const result = await analysisService.analyzeEnglish({
      transcript: "I am having a doubt.",
    });

    expect(result.isCompletelyCorrect).toBe(false);
    expect(result.highConfidenceIssues).toHaveLength(1);
    expect(result.highConfidenceIssues[0]?.category).toBe("NATURALNESS");
    expect(result.highConfidenceIssues[0]?.correctedText).toBe("have a question");
  });

  it("should filter out low confidence candidates (< 0.60) to prevent false positives", async () => {
    mockLLM.setMockConfig({
      cannedResponse: JSON.stringify({
        overallSummary: "Uncertain detection.",
        isCompletelyCorrect: false,
        classificationState: "ambiguous_uncertain",
        issues: [
          {
            category: "GRAMMAR",
            subcategory: "preposition",
            classificationState: "ambiguous_uncertain",
            originalText: "in the weekend",
            correctedText: "on the weekend",
            explanation: "Uncertain dialect variation.",
            severity: 1,
            confidence: 0.40, // Low confidence
            evidenceSpan: { textSnippet: "in the weekend" },
            uncertaintyState: true,
          },
        ],
      }),
    });

    const result = await analysisService.analyzeEnglish({
      transcript: "We met in the weekend.",
    });

    expect(result.highConfidenceIssues).toHaveLength(0);
    expect(result.mediumConfidenceIssues).toHaveLength(0);
    expect(result.filteredLowConfidenceCount).toBe(0); // Rejected by Pass 2 verifier due to < 0.60
    expect(result.isCompletelyCorrect).toBe(true);
  });
});
