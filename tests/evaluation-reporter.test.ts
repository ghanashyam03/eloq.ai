import { describe, it, expect } from "vitest";
import { evaluationReporter } from "@/server/evaluation/evaluation-reporter";

describe("Evaluation Reporter Engine", () => {
  it("should generate a complete, structured EvaluationReport with rendered Markdown", () => {
    const report = evaluationReporter.generateReport({
      promptVersion: "englishAnalysis.v1",
      provider: "huggingface",
    });

    expect(report.title).toContain("English Analysis Evaluation Report");
    expect(report.metrics.precision).toBeGreaterThan(0.0);
    expect(report.calibrationBuckets.length).toBe(5);
    expect(report.adaptiveScenariosPassed).toBe(true);
    expect(report.markdownContent).toContain("# English Analysis Evaluation Report");
    expect(report.markdownContent).toContain("False Positive Rate (FPR)");
    expect(report.markdownContent).toContain("Expected Calibration Error (ECE)");
  });
});
