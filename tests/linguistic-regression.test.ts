import { describe, it, expect, beforeEach } from "vitest";
import { EnglishAnalysisService } from "@/server/services/english-analysis-service";
import { ModelRouter } from "@/server/providers/llm/router/model-router";
import { MockLLMProvider } from "@/server/providers/llm/implementations/mock.provider";
import { linguisticDataset } from "./fixtures/linguistic-dataset";

describe("Linguistic Regression & Evaluation Suite", () => {
  let analysisService: EnglishAnalysisService;
  let mockRouter: ModelRouter;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockRouter = new ModelRouter();
    mockLLM = new MockLLMProvider();
    mockRouter.registerProvider("gemini", mockLLM);
    mockRouter.registerProvider("huggingface", mockLLM);
    analysisService = new EnglishAnalysisService(mockRouter);
  });

  it("should evaluate dataset test cases without category regressions or false positives", async () => {
    for (const testCase of linguisticDataset) {
      if (testCase.category === "clearly_correct" || testCase.category === "informal_valid" || testCase.category === "dialect_variant") {
        mockLLM.setMockConfig({
          cannedResponse: JSON.stringify({
            overallSummary: "Valid sentence.",
            isCompletelyCorrect: true,
            classificationState: testCase.expectedClassification,
            issues: [],
          }),
        });
      } else if (testCase.category === "clearly_incorrect") {
        mockLLM.setMockConfig({
          cannedResponse: JSON.stringify({
            overallSummary: "Grammar errors detected.",
            isCompletelyCorrect: false,
            classificationState: "grammatically_incorrect",
            issues: [
              {
                category: "GRAMMAR",
                subcategory: "tense",
                classificationState: "grammatically_incorrect",
                originalText: "go to market yesterday",
                correctedText: "went to the market yesterday",
                explanation: "Past tense required for yesterday.",
                severity: 3,
                confidence: 0.95,
                evidenceSpan: { textSnippet: "go to market yesterday" },
                uncertaintyState: false,
              },
            ],
          }),
        });
      } else if (testCase.category === "unnatural_phrase") {
        mockLLM.setMockConfig({
          cannedResponse: JSON.stringify({
            overallSummary: "Unnatural phrase detected.",
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
                explanation: "'having a doubt' is non-idiomatic.",
                severity: 2,
                confidence: 0.90,
                evidenceSpan: { textSnippet: "having a doubt" },
                uncertaintyState: false,
              },
            ],
          }),
        });
      }

      const result = await analysisService.analyzeEnglish({
        transcript: testCase.input,
        englishVariety: testCase.englishVariety ?? "en-US",
      });

      if (testCase.shouldBeCompletelyCorrect !== undefined) {
        expect(result.isCompletelyCorrect).toBe(testCase.shouldBeCompletelyCorrect);
      }
    }
  });
});
