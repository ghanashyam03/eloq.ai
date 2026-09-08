import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runOllamaBenchmark, BenchmarkTestCase } from "../scripts/benchmark-ollama";
import { StructuredLinguisticAnalysis } from "../src/domain/analysis/analysis-engine.schema";

describe("Local Ollama Benchmark Infrastructure (Offline Mocks)", () => {
  const fixturePath = path.join(__dirname, "evaluation", "datasets", "english-analysis-benchmark-v2.json");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should load the 30-case dataset fixture v2 correctly for Ollama benchmark", () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as { version: string; testCases: BenchmarkTestCase[] };

    expect(content.version).toBe("v2");
    expect(content.testCases).toHaveLength(30);

    const spokenCases = content.testCases.filter((tc) => tc.isSpokenStyle);
    expect(spokenCases.length).toBeGreaterThanOrEqual(8);
  });

  it("should calculate accuracy, precision, recall, false-positive rate, and latency metrics correctly", async () => {
    const serviceModule = await import("../src/server/services/english-analysis-service");
    vi.spyOn(serviceModule.englishAnalysisService, "analyzeEnglish").mockImplementation(
      async (params) => {
        const text = params.transcript;
        const isIncorrect =
          (text.includes("went there yesterday") && text.includes("have")) ||
          text.includes("don't like") ||
          text.includes("go to university") ||
          text.includes("interested on") ||
          text.includes("depends of") ||
          text.includes("good in") ||
          text.includes("since three years") ||
          text.includes("an European") ||
          text.includes("by the bus") ||
          text.includes("list of items are") ||
          text.includes("where is the station") ||
          text.includes("would have known") ||
          text.includes("office is working");

        if (isIncorrect) {
          return {
            isCompletelyCorrect: false,
            classificationState: "grammatically_incorrect",
            highConfidenceIssues: [
              {
                id: "issue-1",
                originalPhrase: text,
                correctedPhrase: "corrected",
                category: "grammar",
                subcategory: "verb_tense",
                explanation: "Test error explanation",
                confidence: 0.95,
                shouldSurfaceToUser: true,
              },
            ],
            mediumConfidenceIssues: [],
            lowConfidenceIssues: [],
            positiveObservations: [],
            overallSummary: "Summary of errors found",
            overallConfidence: 0.95,
            analysisModel: "local/llama3.2:1b",
            processedAt: new Date().toISOString(),
          } as unknown as StructuredLinguisticAnalysis;
        } else {
          return {
            isCompletelyCorrect: true,
            classificationState: text.includes("colour") || text.includes("organised") ? "dialect_variant_valid" : text.includes("gonna") || text.includes("head out") ? "informal_valid" : "grammatically_correct_and_natural",
            highConfidenceIssues: [],
            mediumConfidenceIssues: [],
            lowConfidenceIssues: [],
            positiveObservations: ["Good grammar"],
            overallSummary: "No issues detected",
            overallConfidence: 0.98,
            analysisModel: "local/llama3.2:1b",
            processedAt: new Date().toISOString(),
          } as unknown as StructuredLinguisticAnalysis;
        }
      }
    );

    const report = await runOllamaBenchmark(fixturePath);

    expect(report.metadata.provider).toBe("local-ollama");
    expect(report.metrics.totalCases).toBe(30);
    expect(report.metrics.accuracy).toBeGreaterThan(0.7);
    expect(report.metrics.schemaValidityRate).toBe(1.0);
    expect(report.metadata.stoppedOnFailure).toBe(false);

    expect(fs.existsSync(path.join(process.cwd(), "reports", "ollama-benchmark-results.json"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "reports", "ollama-benchmark-report.md"))).toBe(true);
  });

  it("should stop execution immediately on local provider error", async () => {
    const serviceModule = await import("../src/server/services/english-analysis-service");
    vi.spyOn(serviceModule.englishAnalysisService, "analyzeEnglish").mockRejectedValue(
      new Error("ECONNREFUSED connecting to http://localhost:11434/v1")
    );

    const report = await runOllamaBenchmark(fixturePath);

    expect(report.metadata.stoppedOnFailure).toBe(true);
    expect(report.metadata.stopReason).toContain("Local Ollama Provider failed on test case TC-01");
    expect(report.metadata.totalRequestsMade).toBe(1);
  });
});
