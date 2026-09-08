import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { ModelRouter } from "@/server/providers/llm/router/model-router";
import { MockLLMProvider } from "@/server/providers/llm/implementations/mock.provider";
import { providerProfileRegistry } from "@/server/providers/llm/registry/provider-profiles";
import { AppError } from "@/lib/errors/app-error";

describe("Model Router & Resilient Execution Engine", () => {
  let router: ModelRouter;
  let primaryMock: MockLLMProvider;
  let fallbackMock: MockLLMProvider;

  beforeEach(() => {
    providerProfileRegistry.resetBudgets();
    router = new ModelRouter();
    primaryMock = new MockLLMProvider({ cannedResponse: "Primary mock response" });
    fallbackMock = new MockLLMProvider({ cannedResponse: "Fallback mock response" });

    // Register mocks in router
    router.registerProvider("gemini", primaryMock);
    router.registerProvider("huggingface", primaryMock);
    router.registerProvider("nvidia", fallbackMock);
    router.registerProvider("openrouter", fallbackMock);
    router.registerProvider("cerebras", fallbackMock);
    router.registerProvider("local", fallbackMock);
    router.registerProvider("mock", fallbackMock);
  });

  it("should route completion requests to the primary provider when healthy", async () => {
    const response = await router.generateCompletion(
      [{ role: "user", content: "Analyze this sentence." }],
      { taskType: "grammar_analysis" }
    );

    expect(response.content).toBe("Primary mock response");
    expect(response.provider).toBe("mock");
  });

  it("should execute controlled fallback when primary provider fails with a retryable error", async () => {
    primaryMock.setMockConfig({
      shouldFail: true,
      failureError: AppError.rateLimit("Primary rate limit exceeded"),
    });

    const response = await router.generateCompletion(
      [{ role: "user", content: "Hello fallback" }],
      { taskType: "conversation" }
    );

    expect(response.content).toBe("Fallback mock response");
  });

  it("should NOT fall back when error is non-retryable (e.g. validation error)", async () => {
    primaryMock.setMockConfig({
      shouldFail: true,
      failureError: AppError.validation("Invalid user input payload"),
    });

    await expect(
      router.generateCompletion(
        [{ role: "user", content: "Bad input" }],
        { taskType: "grammar_analysis" }
      )
    ).rejects.toThrow("Invalid user input payload");
  });

  it("should enforce free-only safety error when all free providers fail", async () => {
    primaryMock.setMockConfig({
      shouldFail: true,
      failureError: AppError.externalProvider("mock", "Outage"),
    });
    fallbackMock.setMockConfig({
      shouldFail: true,
      failureError: AppError.externalProvider("mock", "Outage"),
    });

    await expect(
      router.generateCompletion(
        [{ role: "user", content: "Test" }],
        { taskType: "grammar_analysis" }
      )
    ).rejects.toThrow("No configured free AI provider is currently available.");
  });

  it("should execute structured JSON generation with schema validation", async () => {
    const TestSchema = z.object({
      corrections: z.array(z.string()),
      score: z.number(),
    });

    primaryMock.setMockConfig({
      cannedResponse: JSON.stringify({ corrections: ["Use 'an' instead of 'a'"], score: 90 }),
    });

    const result = await router.generateStructured(
      [{ role: "user", content: "She is a English teacher." }],
      TestSchema,
      { taskType: "grammar_analysis" }
    );

    expect(result.score).toBe(90);
    expect(result.corrections).toContain("Use 'an' instead of 'a'");
  });
});
