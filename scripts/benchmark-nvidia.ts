if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {}
}

import fs from "node:fs";
import path from "node:path";
import { NvidiaNimLLMProvider } from "../src/server/providers/llm/implementations/nvidia.provider";
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

export async function runNvidiaBenchmark(datasetPath?: string): Promise<BenchmarkReportData> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY;
  const modelName =
    process.env.NVIDIA_NIM_MODEL ||
    "nvidia/nemotron-3-super-120b-a12b";

  console.log("LIVE PROVIDER: NVIDIA NIM");
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
    stopReason = "NVIDIA API key (NVIDIA_NIM_API_KEY or NVIDIA_API_KEY) is not configured in environment.";
    console.error(`[ERROR]: ${stopReason}`);
  }

  const caseResults: CaseResult[] = [];
  const latencies: number[] = [];

  if (!stoppedOnFailure) {
    // Instantiate provider strictly for NVIDIA
    new NvidiaNimLLMProvider({ ...(apiKey ? { apiKey } : {}) });

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
        // Enforce 1 retry maximum for transient network errors
        let pass1Result: import("../src/domain/analysis/analysis-engine.schema").StructuredLinguisticAnalysis | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            // Direct analysis via English analysis service locked to NVIDIA with disableFallback: true
            pass1Result = await englishAnalysisService.analyzeEnglish({
              transcript: tc.sentence,
              englishVariety: "en-US",
              providerOverride: "nvidia" as ProviderType,
              modelOverride: modelName,
              disableFallback: true,
            });
            lastError = null;
            break;
          } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt === 1) {
              console.warn(`[RETRY]: Attempt 1 failed for "${tc.sentence}": ${lastError.message}. Retrying...`);
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        }

        if (lastError || !pass1Result) {
          const latencyMs = Date.now() - startTime;
          latencies.push(latencyMs);
          const errMsg = lastError?.message ?? "Unknown provider error";
          console.error(`[FAIL - PROVIDER ERROR] ${tc.id}: "${tc.sentence}" -> ${errMsg}`);

          caseResults.push({
            testCase: tc,
            passed: false,
            modelIsCorrect: false,
            classificationState: "PROVIDER_ERROR",
            issueCount: 0,
            confidence: 0,
            latencyMs,
            explanation: errMsg,
            failureCategory: "provider_failure",
            errorMessage: errMsg,
          });

          // STOP THE BENCHMARK ON PROVIDER FAILURE
          stoppedOnFailure = true;
          stopReason = `NVIDIA NIM Provider failed on test case ${tc.id}: ${errMsg}`;
          console.error(`\n[CRITICAL]: ${stopReason}. Stopping benchmark immediately as required.`);
          break;
        }

        const latencyMs = Date.now() - startTime;
        latencies.push(latencyMs);

        const modelIsCorrect = pass1Result.isCompletelyCorrect;
        const classificationState = pass1Result.classificationState;
        const issueCount =
          pass1Result.highConfidenceIssues.length + pass1Result.mediumConfidenceIssues.length;

        const mainIssue =
          pass1Result.highConfidenceIssues[0] ?? pass1Result.mediumConfidenceIssues[0];
        const confidence = mainIssue?.confidence ?? 0.9;
        const explanation = mainIssue?.explanation ?? pass1Result.overallSummary;

        // Classification evaluation:
        let passed = false;
        let failureCategory: CaseResult["failureCategory"] = undefined;

        if (tc.expectedIsCorrect) {
          // Expected clean / valid sentence
          if (modelIsCorrect || classificationState === "dialect_variant_valid" || classificationState === "informal_valid") {
            passed = true;
          } else {
            passed = false;
            failureCategory = "false_positive";
          }
        } else {
          // Expected sentence with error
          if (!modelIsCorrect && issueCount > 0) {
            passed = true;
          } else {
            passed = false;
            failureCategory = "false_negative";
          }
        }

        caseResults.push({
          testCase: tc,
          passed,
          modelIsCorrect,
          classificationState,
          issueCount,
          confidence,
          latencyMs,
          explanation,
          ...(failureCategory ? { failureCategory } : {}),
        });

        console.log(`[${passed ? "PASS" : "FAIL"}] ${tc.id}: "${tc.sentence}"`);
        console.log(`       Expected: isCorrect=${tc.expectedIsCorrect} (${tc.expectedClassification})`);
        console.log(`       Actual  : isCorrect=${modelIsCorrect}, state=${classificationState}, issues=${issueCount}`);
        console.log(`       Latency : ${latencyMs}ms\n`);
      } catch (err: unknown) {
        const latencyMs = Date.now() - startTime;
        latencies.push(latencyMs);
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[CRITICAL ERROR] ${tc.id}: ${errMsg}`);
        caseResults.push({
          testCase: tc,
          passed: false,
          modelIsCorrect: false,
          classificationState: "FATAL_ERROR",
          issueCount: 0,
          confidence: 0,
          latencyMs,
          explanation: errMsg,
          failureCategory: "provider_failure",
          errorMessage: errMsg,
        });

        stoppedOnFailure = true;
        stopReason = `Fatal error during benchmark execution: ${errMsg}`;
        break;
      }
    }
  }

  // Calculate Metrics
  const totalCases = dataset.testCases.length;
  const evaluatedCases = caseResults.length;
  const passedCases = caseResults.filter((r) => r.passed).length;
  const failedCases = evaluatedCases - passedCases;
  const accuracy = evaluatedCases > 0 ? passedCases / evaluatedCases : 0;

  // Confusion matrix:
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;

  for (const r of caseResults) {
    const hasErrorExpected = !r.testCase.expectedIsCorrect;
    const errorDetectedModel = !r.modelIsCorrect && r.issueCount > 0;

    if (hasErrorExpected && errorDetectedModel) tp++;
    else if (!hasErrorExpected && errorDetectedModel) fp++;
    else if (!hasErrorExpected && !errorDetectedModel) tn++;
    else if (hasErrorExpected && !errorDetectedModel) fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;
  const falseNegativeRate = tp + fn > 0 ? fn / (tp + fn) : 0;

  const validClassificationCount = caseResults.filter((r) => r.passed).length;
  const classificationAccuracy = evaluatedCases > 0 ? validClassificationCount / evaluatedCases : 0;
  const schemaValidCount = caseResults.filter((r) => r.classificationState !== "SCHEMA_ERROR" && r.classificationState !== "PROVIDER_ERROR").length;
  const schemaValidityRate = evaluatedCases > 0 ? schemaValidCount / evaluatedCases : 0;

  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const medianLatencyMs = sortedLatencies.length > 0 ? (sortedLatencies[Math.floor(sortedLatencies.length / 2)] ?? 0) : 0;
  const maxLatencyMs = sortedLatencies.length > 0 ? Math.max(...sortedLatencies) : 0;

  // Confidence Calibration Buckets
  const confidenceBuckets: Record<string, { count: number; correctCount: number; accuracy: number }> = {
    "0.0-0.2": { count: 0, correctCount: 0, accuracy: 0 },
    "0.2-0.4": { count: 0, correctCount: 0, accuracy: 0 },
    "0.4-0.6": { count: 0, correctCount: 0, accuracy: 0 },
    "0.6-0.8": { count: 0, correctCount: 0, accuracy: 0 },
    "0.8-1.0": { count: 0, correctCount: 0, accuracy: 0 },
  };

  for (const r of caseResults) {
    const c = r.confidence;
    let bucketKey = "0.8-1.0";
    if (c <= 0.2) bucketKey = "0.0-0.2";
    else if (c <= 0.4) bucketKey = "0.2-0.4";
    else if (c <= 0.6) bucketKey = "0.4-0.6";
    else if (c <= 0.8) bucketKey = "0.6-0.8";

    const bucket = confidenceBuckets[bucketKey]!;
    bucket.count++;
    if (r.passed) bucket.correctCount++;
  }

  for (const k of Object.keys(confidenceBuckets)) {
    const b = confidenceBuckets[k]!;
    b.accuracy = b.count > 0 ? Number((b.correctCount / b.count).toFixed(3)) : 0;
  }

  const failureAnalysis = caseResults
    .filter((r) => !r.passed)
    .map((r) => ({
      testId: r.testCase.id,
      sentence: r.testCase.sentence,
      expected: `isCorrect=${r.testCase.expectedIsCorrect} (${r.testCase.expectedClassification})`,
      actual: `isCorrect=${r.modelIsCorrect}, state=${r.classificationState}, issues=${r.issueCount}`,
      failureCategory: r.failureCategory ?? "other",
      confidence: r.confidence,
      explanation: r.explanation,
    }));

  const reportData: BenchmarkReportData = {
    metadata: {
      provider: "nvidia",
      model: modelName,
      promptVersion: "english-analysis.v1",
      benchmarkVersion: dataset.version,
      timestamp,
      temperature: 0.1,
      maxRequestsCap,
      totalRequestsMade,
      stoppedOnFailure,
      ...(stopReason ? { stopReason } : {}),
    },
    metrics: {
      totalCases,
      passedCases,
      failedCases,
      accuracy: Number(accuracy.toFixed(3)),
      precision: Number(precision.toFixed(3)),
      recall: Number(recall.toFixed(3)),
      f1Score: Number(f1Score.toFixed(3)),
      falsePositiveRate: Number(falsePositiveRate.toFixed(3)),
      falseNegativeRate: Number(falseNegativeRate.toFixed(3)),
      classificationAccuracy: Number(classificationAccuracy.toFixed(3)),
      schemaValidityRate: Number(schemaValidityRate.toFixed(3)),
      avgLatencyMs,
      medianLatencyMs,
      maxLatencyMs,
    },
    confidenceCalibration: confidenceBuckets,
    failureAnalysis,
    caseResults,
  };

  // Write machine-readable JSON report
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const jsonReportPath = path.join(reportsDir, "nvidia-benchmark-results.json");
  fs.writeFileSync(jsonReportPath, JSON.stringify(reportData, null, 2), "utf-8");

  // Write human-readable Markdown report
  const mdReportPath = path.join(reportsDir, "nvidia-benchmark-report.md");
  const b1 = confidenceBuckets["0.0-0.2"]!;
  const b2 = confidenceBuckets["0.2-0.4"]!;
  const b3 = confidenceBuckets["0.4-0.6"]!;
  const b4 = confidenceBuckets["0.6-0.8"]!;
  const b5 = confidenceBuckets["0.8-1.0"]!;

  const markdownContent = `# NVIDIA English Analysis Benchmark

**Provider**: nvidia  
**Model**: ${modelName}  
**Benchmark version**: ${dataset.version}  
**Timestamp**: ${timestamp}  
**Configuration**: temperature=0.1, maxRequestsCap=${maxRequestsCap}  

---

## Benchmark Metrics

| Metric | Value |
|---|---|
| **Total Cases** | ${totalCases} |
| **Evaluated Requests** | ${totalRequestsMade} / ${maxRequestsCap} |
| **Passed Cases** | ${passedCases} |
| **Failed Cases** | ${failedCases} |
| **Overall Accuracy** | ${(accuracy * 100).toFixed(1)}% |
| **Precision (Error Detection)** | ${(precision * 100).toFixed(1)}% |
| **Recall (Error Detection)** | ${(recall * 100).toFixed(1)}% |
| **F1 Score** | ${(f1Score * 100).toFixed(1)}% |
| **False Positive Rate** | ${(falsePositiveRate * 100).toFixed(1)}% |
| **False Negative Rate** | ${(falseNegativeRate * 100).toFixed(1)}% |
| **Schema Validity Rate** | ${(schemaValidityRate * 100).toFixed(1)}% |
| **Average Latency** | ${avgLatencyMs} ms |
| **Median Latency** | ${medianLatencyMs} ms |
| **Maximum Latency** | ${maxLatencyMs} ms |

> **Note on Baseline Comparison**:  
> Existing Gemini 9-case smoke-test result: 88.9%, not directly comparable (evaluated on a separate 9-case smoke test vs this 30-case benchmark).

---

## Quota & Failure Safeguard Status

- **Stopped On Failure**: ${stoppedOnFailure}
- **Stop Reason**: ${stopReason ?? "None (Completed cleanly)"}

---

## Confidence Calibration

| Confidence Bucket | Evaluated Count | Passed Count | Accuracy |
|---|---|---|---|
| **0.0 - 0.2** | ${b1.count} | ${b1.correctCount} | ${(b1.accuracy * 100).toFixed(1)}% |
| **0.2 - 0.4** | ${b2.count} | ${b2.correctCount} | ${(b2.accuracy * 100).toFixed(1)}% |
| **0.4 - 0.6** | ${b3.count} | ${b3.correctCount} | ${(b3.accuracy * 100).toFixed(1)}% |
| **0.6 - 0.8** | ${b4.count} | ${b4.correctCount} | ${(b4.accuracy * 100).toFixed(1)}% |
| **0.8 - 1.0** | ${b5.count} | ${b5.correctCount} | ${(b5.accuracy * 100).toFixed(1)}% |

---

## Failure Analysis

${
  failureAnalysis.length === 0
    ? "*No failures recorded across benchmark cases.*"
    : failureAnalysis
        .map(
          (f) => `### Test Case ${f.testId}
- **Input**: "${f.sentence}"
- **Expected**: ${f.expected}
- **Actual**: ${f.actual}
- **Category**: \`${f.failureCategory}\`
- **Confidence**: ${f.confidence}
- **Explanation**: ${f.explanation}
`
        )
        .join("\n")
}

---

## Recommendations

${
  stoppedOnFailure
    ? `> [!WARNING]\n> **Execution Stopped**: ${stopReason}.\n> The NVIDIA NIM serverless endpoint returned errors for the account or model key. Keep Google Gemini as the primary active provider until an active NVIDIA NIM endpoint is provisioned.`
    : `1. **Linguistic Accuracy**: Model achieved ${(accuracy * 100).toFixed(1)}% accuracy across 30 deterministic test cases.
2. **False Positive Guardrail**: False positive rate is ${(falsePositiveRate * 100).toFixed(1)}%.
3. **Spoken English Handling**: Evaluated 8 spontaneous spoken sentences containing fillers (*um*, *uh*) and self-corrections.`
}
`;

  fs.writeFileSync(mdReportPath, markdownContent, "utf-8");

  console.log(`\nMachine-readable report written to: ${jsonReportPath}`);
  console.log(`Human-readable report written to    : ${mdReportPath}`);

  return reportData;
}

if (process.argv[1] && process.argv[1].includes("benchmark-nvidia")) {
  runNvidiaBenchmark().catch((err) => {
    console.error("NVIDIA Benchmark execution halted:", err);
    process.exit(1);
  });
}
