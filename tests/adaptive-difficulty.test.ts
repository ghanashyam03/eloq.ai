import { describe, it, expect } from "vitest";
import { adaptiveDifficultyManager } from "@/server/practice/adaptive-difficulty";

describe("Adaptive Difficulty & Progression Manager", () => {
  it("should advance progression stage and CEFR difficulty after 2 consecutive successes", () => {
    const result = adaptiveDifficultyManager.evaluateAdjustment({
      currentStage: "controlled_production",
      currentDifficulty: "B1",
      consecutiveSuccesses: 2,
      consecutiveFailures: 0,
    });

    expect(result.adjustment).toBe("increased");
    expect(result.nextStage).toBe("guided_production");
    expect(result.nextDifficulty).toBe("B2");
    expect(result.reason).toContain("Consecutive successes");
  });

  it("should regress progression stage and CEFR difficulty after 2 consecutive failures for scaffolding", () => {
    const result = adaptiveDifficultyManager.evaluateAdjustment({
      currentStage: "guided_production",
      currentDifficulty: "B2",
      consecutiveSuccesses: 0,
      consecutiveFailures: 2,
    });

    expect(result.adjustment).toBe("reduced");
    expect(result.nextStage).toBe("controlled_production");
    expect(result.nextDifficulty).toBe("B1");
    expect(result.reason).toContain("Recent failures");
  });

  it("should maintain current stage and difficulty when performance is stable (1 success / 0 failures)", () => {
    const result = adaptiveDifficultyManager.evaluateAdjustment({
      currentStage: "controlled_production",
      currentDifficulty: "B1",
      consecutiveSuccesses: 1,
      consecutiveFailures: 0,
    });

    expect(result.adjustment).toBe("unchanged");
    expect(result.nextStage).toBe("controlled_production");
    expect(result.nextDifficulty).toBe("B1");
  });

  it("should cap progression at max C2 and max stage (real_conversation)", () => {
    const result = adaptiveDifficultyManager.evaluateAdjustment({
      currentStage: "real_conversation",
      currentDifficulty: "C2",
      consecutiveSuccesses: 5,
      consecutiveFailures: 0,
    });

    expect(result.nextStage).toBe("real_conversation");
    expect(result.nextDifficulty).toBe("C2");
  });
});
