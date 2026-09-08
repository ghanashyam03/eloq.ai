import { describe, it, expect } from "vitest";
import { z } from "zod";
import { executeAIPipeline } from "@/server/providers/ai-pipeline";
import { AppError } from "@/lib/errors/app-error";

describe("AI Validation Pipeline", () => {
  const TestDomainSchema = z.object({
    score: z.number().min(0).max(100),
    feedback: z.string().min(1),
  });

  it("should successfully parse raw JSON string wrapped in markdown code fences", async () => {
    const rawOutput = "```json\n{\n  \"score\": 85,\n  \"feedback\": \"Good pronunciation\"\n}\n```";

    const result = await executeAIPipeline(rawOutput, {
      providerName: "MockLLM",
      operationName: "testAnalysis",
      schema: TestDomainSchema,
    });

    expect(result.score).toBe(85);
    expect(result.feedback).toBe("Good pronunciation");
  });

  it("should throw AppError validation when model output fails Zod schema verification", async () => {
    const invalidOutput = JSON.stringify({
      score: 150, // exceeds max 100
      feedback: "", // fails min length 1
    });

    await expect(
      executeAIPipeline(invalidOutput, {
        providerName: "MockLLM",
        operationName: "testAnalysis",
        schema: TestDomainSchema,
      })
    ).rejects.toThrow(AppError);
  });

  it("should throw AppError externalProvider when raw output is unparseable text", async () => {
    const unparseableOutput = "Sorry, I cannot answer this request.";

    await expect(
      executeAIPipeline(unparseableOutput, {
        providerName: "MockLLM",
        operationName: "testAnalysis",
        schema: TestDomainSchema,
      })
    ).rejects.toThrow(AppError);
  });
});
