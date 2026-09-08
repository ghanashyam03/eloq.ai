import { describe, it, expect } from "vitest";
import { confidenceCalibrator, PredictionConfidenceItem } from "@/server/evaluation/confidence-calibrator";

describe("Confidence Calibrator Engine", () => {
  it("should classify predictions into 5 confidence buckets and compute Expected Calibration Error (ECE)", () => {
    const items: PredictionConfidenceItem[] = [
      { confidence: 0.95, isEmpiricallyCorrect: true },
      { confidence: 0.90, isEmpiricallyCorrect: true },
      { confidence: 0.85, isEmpiricallyCorrect: false },
      { confidence: 0.70, isEmpiricallyCorrect: true },
      { confidence: 0.50, isEmpiricallyCorrect: false },
      { confidence: 0.10, isEmpiricallyCorrect: false },
    ];

    const result = confidenceCalibrator.evaluateCalibration(items);

    expect(result.buckets.length).toBe(5);
    const topBucket = result.buckets.find((b) => b.bucket === "0.8-1.0");
    expect(topBucket).toBeDefined();
    expect(topBucket?.totalPredictions).toBe(3);
    expect(topBucket?.correctPredictions).toBe(2);

    expect(result.expectedCalibrationError).toBeGreaterThanOrEqual(0.0);
  });
});
