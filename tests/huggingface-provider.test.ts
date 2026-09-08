import { describe, it, expect } from "vitest";
import { HuggingFaceLLMProvider } from "@/server/providers/llm/implementations/huggingface.provider";

describe("HuggingFace LLM Provider", () => {
  it("should initialize cleanly without throwing and report as free provider", () => {
    const provider = new HuggingFaceLLMProvider();
    expect(provider.providerName).toBe("huggingface");
    expect(provider.isFree).toBe(true);
  });
});
