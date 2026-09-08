import { describe, it, expect } from "vitest";
import { evaluationMetricsEngine, TestPredictionResult } from "@/server/evaluation/evaluation-metrics";

describe("Evaluation Metrics Engine", () => {
  it("should calculate exact precision, recall, F1, FPR, FNR, and accuracy", () => {
    const results: TestPredictionResult[] = [
      // 8 True Positives (actual error, predicted error)
      ...Array.from({ length: 8 }).map((_, i) => ({
        testCaseId: `tp-${i}`,
        isCompletelyCorrectExpected: false,
        isCompletelyCorrectPredicted: false,
        detectedIssueCount: 1,
      })),
      // 2 False Positives (actual correct, predicted error)
      ...Array.from({ length: 2 }).map((_, i) => ({
        testCaseId: `fp-${i}`,
        isCompletelyCorrectExpected: true,
        isCompletelyCorrectPredicted: false,
        detectedIssueCount: 1,
      })),
      // 8 True Negatives (actual correct, predicted correct)
      ...Array.from({ length: 8 }).map((_, i) => ({
        testCaseId: `tn-${i}`,
        isCompletelyCorrectExpected: true,
        isCompletelyCorrectPredicted: true,
        detectedIssueCount: 0,
      })),
      // 2 False Negatives (actual error, predicted correct)
      ...Array.from({ length: 2 }).map((_, i) => ({
        testCaseId: `fn-${i}`,
        isCompletelyCorrectExpected: false,
        isCompletelyCorrectPredicted: true,
        detectedIssueCount: 0,
      })),
    ];

    const metrics = evaluationMetricsEngine.calculateMetrics(results);

    expect(metrics.totalCases).toBe(20);
    expect(metrics.truePositives).toBe(8);
    expect(metrics.falsePositives).toBe(2);
    expect(metrics.trueNegatives).toBe(8);
    expect(metrics.falseNegatives).toBe(2);

    expect(metrics.precision).toBe(0.8); // 8 / (8 + 2)
    expect(metrics.recall).toBe(0.8); // 8 / (8 + 2)
    expect(metrics.f1).toBe(0.8);
    expect(metrics.falsePositiveRate).toBe(0.2); // 2 / (2 + 8)
    expect(metrics.falseNegativeRate).toBe(0.2); // 2 / (2 + 8)
    expect(metrics.accuracy).toBe(0.8); // 16 / 20
  });

  it("should handle edge cases with 0 false positives gracefully", () => {
    const perfectResults: TestPredictionResult[] = [
      { testCaseId: "c-1", isCompletelyCorrectExpected: true, isCompletelyCorrectPredicted: true, detectedIssueCount: 0 },
      { testCaseId: "e-1", isCompletelyCorrectExpected: false, isCompletelyCorrectPredicted: false, detectedIssueCount: 1 },
    ];

    const metrics = evaluationMetricsEngine.calculateMetrics(perfectResults);

    expect(metrics.falsePositives).toBe(0);
    expect(metrics.falsePositiveRate).toBe(0.0);
    expect(metrics.precision).toBe(1.0);
    expect(metrics.recall).toBe(1.0);
    expect(metrics.f1).toBe(1.0);
  });
});
