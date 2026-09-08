import { describe, it, expect } from "vitest";
import { scoreEngine } from "@/server/evaluation/score-engine";

describe("Multi-Dimensional Score Engine", () => {
  it("should enforce minimum sample size threshold (N >= 3) and return Insufficient evidence when N < 3", () => {
    const insufficientScore = scoreEngine.calculateDimensionScore({
      dimension: "speaking",
      totalAttempts: 2, // Less than 3 minimum threshold!
      successfulAttempts: 2,
      errorCount: 0,
      averageConfidence: 0.9,
    });

    expect(insufficientScore.hasEnoughEvidence).toBe(false);
    expect(insufficientScore.value).toBeNull();
    expect(insufficientScore.statusText).toContain("Insufficient evidence");
  });

  it("should calculate evidence-backed score when sample size N >= 3", () => {
    const validScore = scoreEngine.calculateDimensionScore({
      dimension: "grammar",
      totalAttempts: 10,
      successfulAttempts: 8,
      errorCount: 2,
      averageConfidence: 0.92,
    });

    expect(validScore.hasEnoughEvidence).toBe(true);
    expect(validScore.value).toBe(76.0); // 8/10 * 100 - 4 = 76
    expect(validScore.version).toBe("grammarScore.v1");
    expect(validScore.statusText).toContain("Evidence-backed score");
  });
});
