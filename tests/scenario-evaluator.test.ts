import { describe, it, expect } from "vitest";
import { scenarioEvaluator } from "@/server/evaluation/scenario-evaluator";

describe("Adaptive Engine Scenario Evaluator", () => {
  it("should evaluate lifecycle scenarios and verify deterministic state transitions", () => {
    const scenarioResults = scenarioEvaluator.evaluateAdaptiveScenarios();

    expect(scenarioResults.length).toBeGreaterThanOrEqual(4);
    for (const res of scenarioResults) {
      expect(res.passed).toBe(true);
      expect(res.details).toBeDefined();
    }
  });
});
