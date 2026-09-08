if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {}
}

import fs from "node:fs";
import path from "node:path";
import { OpenRouterLLMProvider } from "../src/server/providers/llm/implementations/openrouter.provider";
import { englishAnalysisService } from "../src/server/services/english-analysis-service";
import { ProviderType } from "../src/server/providers/llm/registry/model-task.types";

export interface BenchmarkTestCase {
  id: string;
  sentence: string;
  expectedClassification: string;
  expectedIsCorrect: boolean;
  category: string;
  expectedCorrection: string | null;
  shouldSurface: boolean;
  isSpokenStyle: boolean;
  description: string;
}

export interface BenchmarkDataset {
  version: string;
  description: string;
  testCases: BenchmarkTestCase[];
}

export interface CaseResult {
  testCase: BenchmarkTestCase;
  passed: boolean;
  modelIsCorrect: boolean;
  classificationState: string;
  issueCount: number;
  confidence: number;
  latencyMs: number;
  explanation: string;
  failureCategory?:
    | "false_positive"
    | "false_negative"
    | "wrong_correction"
    | "wrong_category"
    | "wrong_dialect_handling"
    | "wrong_naturalness_handling"
    | "schema_failure"
    | "provider_failure"
    | "other";
  errorMessage?: string;
  rawOutput?: string;
}

export interface BenchmarkReportData {
  metadata: {
    provider: string;
    model: string;
    promptVersion: string;
    benchmarkVersion: string;
    timestamp: string;
    temperature: number;
    maxRequestsCap: number;
    totalRequestsMade: number;
    stoppedOnFailure: boolean;
    stopReason?: string;
  };
  metrics: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
    classificationAccuracy: number;
    schemaValidityRate: number;
    avgLatencyMs: number;
    medianLatencyMs: number;
    maxLatencyMs: number;
  };
  confidenceCalibration: Record<string, { count: number; correctCount: number; accuracy: number }>;
  failureAnalysis: Array<{
    testId: string;
    sentence: string;
    expected: string;
    actual: string;
    failureCategory: string;
    confidence: number;
    explanation: string;
  }>;
  caseResults: CaseResult[];
}

export async function runOpenRouterBenchmark(datasetPath?: string): Promise<BenchmarkReportData> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelName =
    process.env.OPENROUTER_MODEL ||
    "openrouter/free";

  console.log("LIVE PROVIDER: OPENROUTER");
  console.log(`MODEL: ${modelName}`);
  console.log("MAX REQUESTS: 50\n");

  const actualDatasetPath =
    datasetPath ??
    path.join(process.cwd(), "tests", "evaluation", "datasets", "english-analysis-benchmark-v2.json");

  if (!fs.existsSync(actualDatasetPath)) {
    throw new Error(`Benchmark dataset fixture not found at path: ${actualDatasetPath}`);
  }

  const rawDataset = fs.readFileSync(actualDatasetPath, "utf-8");
  const dataset: BenchmarkDataset = JSON.parse(rawDataset);

  const timestamp = new Date().toISOString();
  const maxRequestsCap = 50;
  let totalRequestsMade = 0;
  let stoppedOnFailure = false;
  let stopReason: string | undefined = undefined;

  if (!apiKey) {
    stoppedOnFailure = true;
    stopReason = "OpenRouter API key (OPENROUTER_API_KEY) is not configured in environment.";
    console.error(`[ERROR]: ${stopReason}`);
  }

  const caseResults: CaseResult[] = [];
  const latencies: number[] = [];

  if (!stoppedOnFailure) {
    new OpenRouterLLMProvider({ ...(apiKey ? { apiKey } : {}) });

    for (const tc of dataset.testCases) {
      if (totalRequestsMade >= maxRequestsCap) {
        console.warn(`[SAFETY]: Reached hard maximum request budget of ${maxRequestsCap}. Stopping benchmark.`);
        stoppedOnFailure = true;
        stopReason = `Reached maximum request budget cap (${maxRequestsCap})`;
        break;
      }

      totalRequestsMade++;
      const startTime = Date.now();

      try {
        let pass1Result: import("../src/domain/analysis/analysis-engine.schema").StructuredLinguisticAnalysis | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            pass1Result = await englishAnalysisService.analyzeEnglish({
              transcript: tc.sentence,
              englishVariety: "en-US",
              providerOverride: "openrouter" as ProviderType,
              modelOverride: modelName,
              disableFallback: true,
            });
            lastError = null;
            break;
          } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt === 1) {
              console.warn(`[RETRY]: Attempt 1 failed for "${tc.sentence}": ${lastError.message}. Retrying in 1s...`);
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        }

        if (!pass1Result) {
          throw lastError ?? new Error("OpenRouter analysis failed after 2 attempts.");
        }

        const latencyMs = Date.now() - startTime;
        latencies.push(latencyMs);

        const modelIsCorrect = pass1Result.isCompletelyCorrect;
        const matchesCorrectness = modelIsCorrect === tc.expectedIsCorrect;

        let failureCat: CaseResult["failureCategory"] = undefined;
        if (!matchesCorrectness) {
          if (!tc.expectedIsCorrect && modelIsCorrect) {
            failureCat = "false_negative";
          } else if (tc.expectedIsCorrect && !modelIsCorrect) {
            failureCat = "false_positive";
          } else {
            failureCat = "wrong_category";
          }
        }

        caseResults.push({
          testCase: tc,
          passed: matchesCorrectness,
          modelIsCorrect,
          classificationState: pass1Result.classificationState,
          issueCount: pass1Result.highConfidenceIssues.length,
          confidence: pass1Result.highConfidenceIssues[0]?.confidence ?? (pass1Result.isCompletelyCorrect ? 0.95 : 0.70),
          latencyMs,
          explanation: pass1Result.overallSummary,
          ...(failureCat ? { failureCategory: failureCat } : {}),
          rawOutput: JSON.stringify(pass1Result),
        });

        console.log(
          `[TC ${tc.id}] ${matchesCorrectness ? "PASS" : "FAIL"} (${latencyMs}ms) - Model Correct: ${modelIsCorrect} | Expected: ${tc.expectedIsCorrect}`
        );
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[CRITICAL FAILURE] OpenRouter failed on test case ${tc.id}: ${errorMsg}`);
        stoppedOnFailure = true;
        stopReason = `OpenRouter Provider failed on test case ${tc.id}: ${errorMsg}`;

        caseResults.push({
          testCase: tc,
          passed: false,
          modelIsCorrect: false,
          classificationState: "provider_failure",
          issueCount: 0,
          confidence: 0,
          latencyMs: Date.now() - startTime,
          explanation: `Provider call failed: ${errorMsg}`,
          failureCategory: "provider_failure",
          errorMessage: errorMsg,
        });

        break;
      }
    }
  }

  // Calculate Summary Metrics
  const totalCases = caseResults.length;
  const passedCases = caseResults.filter((c) => c.passed).length;
  const failedCases = totalCases - passedCases;
  const accuracy = totalCases > 0 ? passedCases / totalCases : 0;

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const c of caseResults) {
    const expectedIncorrect = !c.testCase.expectedIsCorrect;
    const actualIncorrect = !c.modelIsCorrect;

    if (expectedIncorrect && actualIncorrect) tp++;
    else if (!expectedIncorrect && actualIncorrect) fp++;
    else if (!expectedIncorrect && !actualIncorrect) tn++;
    else if (expectedIncorrect && !actualIncorrect) fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;
  const falseNegativeRate = fn + tp > 0 ? fn / (fn + tp) : 0;

  const validSchemaCount = caseResults.filter((c) => c.classificationState !== "provider_failure" && c.classificationState !== "schema_failure").length;
  const schemaValidityRate = totalCases > 0 ? validSchemaCount / totalCases : 0;

  latencies.sort((a, b) => a - b);
  const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const medianLatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length / 2)]! : 0;
  const maxLatencyMs = latencies.length > 0 ? latencies[latencies.length - 1]! : 0;

  const reportData: BenchmarkReportData = {
    metadata: {
      provider: "openrouter",
      model: modelName,
      promptVersion: "v2-structured-guardrails",
      benchmarkVersion: dataset.version,
      timestamp,
      temperature: 0.2,
      maxRequestsCap,
      totalRequestsMade,
      stoppedOnFailure,
      ...(stopReason ? { stopReason } : {}),
    },
    metrics: {
      totalCases,
      passedCases,
      failedCases,
      accuracy,
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      falseNegativeRate,
      classificationAccuracy: accuracy,
      schemaValidityRate,
      avgLatencyMs,
      medianLatencyMs,
      maxLatencyMs,
    },
    confidenceCalibration: {},
    failureAnalysis: caseResults
      .filter((c) => !c.passed)
      .map((c) => ({
        testId: c.testCase.id,
        sentence: c.testCase.sentence,
        expected: c.testCase.expectedIsCorrect ? "Clean/Correct" : "Contains Error",
        actual: c.modelIsCorrect ? "Clean/Correct" : "Contains Error",
        failureCategory: c.failureCategory ?? "other",
        confidence: c.confidence,
        explanation: c.explanation,
      })),
    caseResults,
  };

  // Write Report Files
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const jsonReportPath = path.join(reportsDir, "openrouter-benchmark-results.json");
  const mdReportPath = path.join(reportsDir, "openrouter-benchmark-report.md");

  fs.writeFileSync(jsonReportPath, JSON.stringify(reportData, null, 2), "utf-8");

  const mdContent = `# OpenRouter LLM Benchmark Report

- **Provider**: \`openrouter\`
- **Model**: \`${modelName}\`
- **Benchmark Version**: \`${dataset.version}\`
- **Timestamp**: \`${timestamp}\`
- **Stopped On Failure**: \`${stoppedOnFailure}\` ${stopReason ? `(\`${stopReason}\`)` : ""}

## Summary Metrics

| Metric | Score |
|---|---|
| **Accuracy** | \`${(accuracy * 100).toFixed(1)}%\` |
| **Precision** | \`${(precision * 100).toFixed(1)}%\` |
| **Recall** | \`${(recall * 100).toFixed(1)}%\` |
| **F1 Score** | \`${(f1Score * 100).toFixed(1)}%\` |
| **False Positive Rate** | \`${(falsePositiveRate * 100).toFixed(1)}%\` |
| **False Negative Rate** | \`${(falseNegativeRate * 100).toFixed(1)}%\` |
| **Schema Validity Rate** | \`${(schemaValidityRate * 100).toFixed(1)}%\` |
| **Avg Latency** | \`${avgLatencyMs.toFixed(0)} ms\` |
| **Median Latency** | \`${medianLatencyMs.toFixed(0)} ms\` |

---
*Report generated by Englisher Automated OpenRouter Benchmark Suite.*
`;

  fs.writeFileSync(mdReportPath, mdContent, "utf-8");
  console.log(`\nBenchmark completed. Reports written to:\n  - ${jsonReportPath}\n  - ${mdReportPath}`);

  return reportData;
}

if (require.main === module) {
  runOpenRouterBenchmark().catch((err) => {
    console.error("OpenRouter benchmark failed:", err);
    process.exit(1);
  });
}
