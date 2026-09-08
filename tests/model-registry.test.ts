import { describe, it, expect } from "vitest";
import { modelRegistry } from "@/server/providers/llm/registry/model-registry";

describe("Model Registry", () => {
  it("should list active models for specific task types", () => {
    const models = modelRegistry.getModelsForTask("grammar_analysis", true);
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.isFree)).toBe(true);
    expect(models.every((m) => m.status === "active")).toBe(true);
  });

  it("should look up models by provider and modelId", () => {
    const model = modelRegistry.getModel("huggingface", "meta-llama/Llama-3.2-3B-Instruct");
    expect(model).toBeDefined();
    expect(model?.displayName).toContain("Llama 3.2");
    expect(model?.capabilities.streaming).toBe("supported");
  });

  it("should allow registering new custom model metadata without inventing capabilities", () => {
    modelRegistry.registerModel({
      provider: "local",
      modelId: "custom-local-v1",
      displayName: "Custom Local Model",
      isFree: true,
      capabilities: {
        streaming: "supported",
        structuredOutput: "unknown",
        reasoning: "unknown",
        vision: "unsupported",
      },
      status: "active",
      intendedTasks: ["conversation"],
    });

    const registered = modelRegistry.getModel("local", "custom-local-v1");
    expect(registered).toBeDefined();
    expect(registered?.capabilities.structuredOutput).toBe("unknown");
  });
});
