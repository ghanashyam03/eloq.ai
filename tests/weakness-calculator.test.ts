import { describe, it, expect } from "vitest";
import { weaknessCalculator } from "@/server/learning/weakness-calculator";

describe("Deterministic Weakness Calculator", () => {
  it("should calculate priority score considering frequency, severity, recency, and confidence", () => {
    const priority = weaknessCalculator.calculatePriorityScore({
      occurrenceCount: 5,
      distinctSessionCount: 3,
      averageSeverity: 4,
      averageConfidence: 0.90,
      lastDetectedAt: new Date(),
    });

    expect(priority).toBeGreaterThan(0.0);
  });

  it("should assign insufficient_evidence trend if sample size is less than 3", () => {
    const dates = [new Date("2026-09-01"), new Date("2026-09-02")];
    const trend = weaknessCalculator.calculateTrend(dates);
    expect(trend).toBe("insufficient_evidence");
  });

  it("should detect improving trend when occurrence rate decreases over time", () => {
    const dates = [
      new Date("2026-08-01"),
      new Date("2026-08-02"),
      new Date("2026-08-03"),
      new Date("2026-09-01"), // large gap
    ];
    const trend = weaknessCalculator.calculateTrend(dates);
    expect(trend).toBe("improving");
  });

  it("should estimate mastery based on successes and attempt volume", () => {
    const mastery = weaknessCalculator.calculateMastery({
      totalAttempts: 10,
      successes: 8,
      failures: 2,
      spontaneousSuccesses: 5,
      controlledSuccesses: 3,
      lastSuccessAt: new Date(),
    });

    expect(mastery).toBeGreaterThan(0.70);
  });

  it("should handle status transitions for relapse state (mastered -> relapsed)", () => {
    const status = weaknessCalculator.evaluateStatus(
      0.80, // mastery
      2,    // recent occurrence count
      true  // previously mastered
    );

    expect(status).toBe("relapsed");
  });
});
