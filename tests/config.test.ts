import { describe, it, expect } from "vitest";
import { config } from "@/lib/config/env";

describe("Configuration System", () => {
  it("should validate and export typed frozen configuration", () => {
    expect(config).toBeDefined();
    expect(config.NODE_ENV).toBe("test");
    expect(config.DATABASE_URL).toBeDefined();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("should provide default values for provider settings", () => {
    expect(["huggingface", "cerebras", "openai-compatible", "local", "mock", "gemini", "nvidia"]).toContain(config.PRIMARY_LLM_PROVIDER);
    expect(["whisper", "deepgram", "mock"]).toContain(config.STT_PROVIDER);
  });
});
