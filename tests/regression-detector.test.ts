import { describe, it, expect } from "vitest";
import { regressionDetector } from "@/server/evaluation/regression-detector";
import { MetricSummary } from "@/domain/evaluation/evaluation.schema";

describe("Regression Detector Engine", () => {
  const baselineMetrics: MetricSummary = {
    totalCases: 20,
    truePositives: 9,
    falsePositives: 1,
    trueNegatives: 9,
    falseNegatives: 1,
    precision: 0.9,
    recall: 0.9,
    f1: 0.9,
    falsePositiveRate: 0.05,
    falseNegativeRate: 0.1,
    accuracy: 0.9,
  };

  it("should detect regressions when precision degrades or false positive rate increases", () => {
    const degradedMetrics: MetricSummary = {
      ...baselineMetrics,
      precision: 0.75,
      falsePositiveRate: 0.15,
    };

    const report = regressionDetector.detectRegressions({
      promptVersion: "englishAnalysis.v2",
      previousPromptVersion: "englishAnalysis.v1",
      provider: "huggingface",
      currentMetrics: degradedMetrics,
      previousMetrics: baselineMetrics,
    });

    expect(report.regressions.length).toBeGreaterThan(0);
    expect(report.regressions.some((r) => r.includes("Precision degraded"))).toBe(true);
    expect(report.regressions.some((r) => r.includes("False Positive Rate increased"))).toBe(true);
  });

  it("should detect improvements when metrics improve over baseline", () => {
    const improvedMetrics: MetricSummary = {
      ...baselineMetrics,
      precision: 0.98,
      falsePositiveRate: 0.01,
    };

    const report = regressionDetector.detectRegressions({
      promptVersion: "englishAnalysis.v2",
      previousPromptVersion: "englishAnalysis.v1",
      provider: "huggingface",
      currentMetrics: improvedMetrics,
      previousMetrics: baselineMetrics,
    });

    expect(report.improvements.length).toBeGreaterThan(0);
    expect(report.improvements.some((i) => i.includes("Precision improved"))).toBe(true);
  });
});
