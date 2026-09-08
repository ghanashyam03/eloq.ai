import { describe, it, expect, beforeEach } from "vitest";
import { usageTracker } from "@/server/providers/llm/metrics/usage-tracker";

describe("Usage Tracker", () => {
  beforeEach(() => {
    usageTracker.clear();
  });

  it("should record and retrieve usage metric records", () => {
    usageTracker.recordUsage({
      taskType: "grammar_analysis",
      provider: "huggingface",
      model: "meta-llama/Llama-3.2-3B-Instruct",
      promptTokens: 120,
      completionTokens: 45,
      totalTokens: 165,
      latencyMs: 340,
      success: true,
    });

    const metrics = usageTracker.getMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.taskType).toBe("grammar_analysis");
    expect(metrics[0]?.provider).toBe("huggingface");
    expect(metrics[0]?.totalTokens).toBe(165);
  });
});
