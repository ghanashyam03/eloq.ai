if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore if .env does not exist
  }
}

import type { ProviderType } from "../src/server/providers/llm/registry/model-task.types";

interface LiveTestCase {
  id: string;
  sentence: string;
  expectedCorrect: boolean;
  expectedClassification: "incorrect" | "correct_or_valid_variant";
  description: string;
}

const EVALUATION_DATASET: LiveTestCase[] = [
  {
    id: "TC-1",
    sentence: "I have went there yesterday.",
    expectedCorrect: false,
    expectedClassification: "incorrect",
    description: "Present perfect with specific past temporal adverb 'yesterday'",
  },
  {
    id: "TC-2",
    sentence: "I went there yesterday.",
    expectedCorrect: true,
    expectedClassification: "correct_or_valid_variant",
    description: "Simple past tense with 'yesterday'",
  },
  {
    id: "TC-3",
    sentence: "I am interested on astronomy.",
    expectedCorrect: false,
    expectedClassification: "incorrect",
    description: "Preposition error after 'interested' (on -> in)",
  },
  {
    id: "TC-4",
    sentence: "I am interested in astronomy.",
    expectedCorrect: true,
    expectedClassification: "correct_or_valid_variant",
    description: "Correct preposition after 'interested in'",
  },
  {
    id: "TC-5",
    sentence: "I haven't seen him yesterday.",
    expectedCorrect: false,
    expectedClassification: "incorrect",
    description: "Present perfect with past temporal adverb 'yesterday'",
  },
  {
    id: "TC-6",
    sentence: "I haven't seen him recently.",
    expectedCorrect: true,
    expectedClassification: "correct_or_valid_variant",
    description: "Present perfect with valid temporal adverb 'recently'",
  },
  {
    id: "TC-7",
    sentence: "The colour of the car is red.",
    expectedCorrect: true,
    expectedClassification: "correct_or_valid_variant",
    description: "Valid British English spelling 'colour'",
  },
  {
    id: "TC-8",
    sentence: "I'll head out in a minute.",
    expectedCorrect: true,
    expectedClassification: "correct_or_valid_variant",
    description: "Natural informal phrasal expression 'head out'",
  },
  {
    id: "TC-9",
    sentence: "She don't like it.",
    expectedCorrect: false,
    expectedClassification: "incorrect",
    description: "Subject-verb agreement error (don't -> doesn't)",
  },
];

async function runLiveAIEvaluation() {
  const { config } = await import("../src/lib/config/env");
  const { englishAnalysisService } = await import("../src/server/services/english-analysis-service");
  const { llmHealthCheckService } = await import("../src/server/providers/llm/health-check");

  console.log("==================================================");
  console.log(" REAL FREE AI PROVIDER LIVE EVALUATION & AUDIT    ");
  console.log("==================================================\n");

  const providerType: ProviderType =
    (process.env.PRIMARY_LLM_PROVIDER as ProviderType) ??
    (config.PRIMARY_LLM_PROVIDER as ProviderType) ??
    "gemini";

  const modelName =
    process.env.PRIMARY_LLM_MODEL ??
    (providerType === "gemini" ? "gemini-3.6-flash" : "google/gemma-3-12b-it");

  console.log(`Configured Provider : ${providerType}`);
  console.log(`Configured Model    : ${modelName}`);
  console.log(`FREE_ONLY_MODE      : ${config.FREE_ONLY_MODE}`);

  // 1. Run Provider Health Check
  const health = await llmHealthCheckService.checkProviderHealth(providerType, modelName);

  if (!health.isConfigured) {
    console.log(`\n[SKIP] ${health.error}`);
    console.log("No live API keys configured. Standard mock test suite remains fully operational.");
    process.exit(0);
  }

  if (!health.isHealthy) {
    console.error(`\n[FAIL] Health check failed for provider '${providerType}': ${health.error}`);
    process.exit(1);
  }

  console.log(`Health Check Status : SUCCESS (Ping Latency: ${health.latencyMs}ms)\n`);

  console.log("--------------------------------------------------------------------------------");
  console.log("STARTING DETERMINISTIC ENGLISH LINGUISTIC BENCHMARK (Max 9 requests)...");
  console.log("--------------------------------------------------------------------------------\n");

  const results: Array<{
    testCase: LiveTestCase;
    passed: boolean;
    modelCorrectFlag: boolean;
    classificationState: string;
    issueCount: number;
    latencyMs: number;
    explanationSnippet: string;
  }> = [];

  const maxRequests = 10; // Rate/Cost protection hard cap
  let requestCount = 0;

  for (const tc of EVALUATION_DATASET) {
    if (requestCount >= maxRequests) {
      console.warn(`[SAFETY] Maximum request limit (${maxRequests}) reached. Stopping evaluation.`);
      break;
    }
    if (requestCount > 0) {
      // Pacing delay (8.5s) to stay well within Gemini free-tier rate limits (15 RPM)
      await new Promise((resolve) => setTimeout(resolve, 8500));
    }
    requestCount++;

    const start = Date.now();
    try {
      const analysis = await englishAnalysisService.analyzeEnglish({
        transcript: tc.sentence,
        englishVariety: "en-US",
      });
      const latencyMs = Date.now() - start;

      const modelCorrectFlag = analysis.isCompletelyCorrect;
      const classificationState = analysis.classificationState;
      const issueCount = analysis.highConfidenceIssues.length + analysis.mediumConfidenceIssues.length;

      // Evaluation criteria matching:
      // If expectedCorrect is true -> model should report isCompletelyCorrect OR classificationState is valid/informal/correct.
      // If expectedCorrect is false -> model should detect issues and mark sentence incorrect.
      let passed = false;
      if (tc.expectedCorrect) {
        passed = modelCorrectFlag || classificationState !== "grammatically_incorrect";
      } else {
        passed = !modelCorrectFlag && issueCount > 0;
      }

      const explanationSnippet =
        analysis.highConfidenceIssues[0]?.explanation ??
        analysis.mediumConfidenceIssues[0]?.explanation ??
        analysis.overallSummary;

      results.push({
        testCase: tc,
        passed,
        modelCorrectFlag,
        classificationState,
        issueCount,
        latencyMs,
        explanationSnippet,
      });

      console.log(`[${passed ? "PASS" : "FAIL"}] ${tc.id}: "${tc.sentence}"`);
      console.log(`       Expected Correct : ${tc.expectedCorrect}`);
      console.log(`       Model Reported   : isCorrect=${modelCorrectFlag}, state=${classificationState}, issues=${issueCount}`);
      console.log(`       Latency          : ${latencyMs}ms`);
      console.log(`       Explanation      : ${explanationSnippet}\n`);
    } catch (err) {
      const latencyMs = Date.now() - start;
      console.error(`[FAIL] ${tc.id}: "${tc.sentence}" - Error: ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        testCase: tc,
        passed: false,
        modelCorrectFlag: false,
        classificationState: "ERROR",
        issueCount: 0,
        latencyMs,
        explanationSnippet: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Summary Report
  const totalCases = results.length;
  const passedCases = results.filter((r) => r.passed).length;
  const failedCases = totalCases - passedCases;
  const avgLatency = Math.round(results.reduce((a, b) => a + b.latencyMs, 0) / totalCases);

  console.log("==================================================");
  console.log(" FINAL LIVE AI EVALUATION SUMMARY                 ");
  console.log("==================================================");
  console.log(`Provider & Model    : ${providerType} (${modelName})`);
  console.log(`Total Live Requests : ${requestCount}`);
  console.log(`Passed Test Cases   : ${passedCases} / ${totalCases}`);
  console.log(`Failed Test Cases   : ${failedCases}`);
  console.log(`Accuracy Score      : ${((passedCases / totalCases) * 100).toFixed(1)}%`);
  console.log(`Average Latency     : ${avgLatency}ms`);
  console.log(`FREE_ONLY_MODE      : Enforced (${config.FREE_ONLY_MODE})\n`);

  if (failedCases > 0) {
    console.log("DISCOVERED MODEL ACCURACY ISSUES:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(` - ${r.testCase.id} "${r.testCase.sentence}": Expected ${r.testCase.expectedCorrect ? "Correct" : "Incorrect"}, got model output isCorrect=${r.modelCorrectFlag}`);
      });
  }

  if (failedCases === 0) {
    console.log("All evaluation test cases passed against live provider schema verification!");
  }
}

runLiveAIEvaluation().catch((err) => {
  console.error("Live AI evaluation script failed:", err);
  process.exit(1);
});
