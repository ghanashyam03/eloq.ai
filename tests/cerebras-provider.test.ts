import { describe, it, expect } from "vitest";
import { CerebrasLLMProvider } from "@/server/providers/llm/implementations/cerebras.provider";
import { AppError } from "@/lib/errors/app-error";

describe("Cerebras LLM Provider", () => {
  it("should throw externalProvider error if API key is unconfigured when calling API", async () => {
    const provider = new CerebrasLLMProvider(""); // empty API key
    await expect(
      provider.generateCompletion([{ role: "user", content: "Hello" }])
    ).rejects.toThrow(AppError);
  });

  it("should report provider metadata correctly", () => {
    const provider = new CerebrasLLMProvider("dummy-key");
    expect(provider.providerName).toBe("cerebras");
    expect(provider.isFree).toBe(true);
  });
});
