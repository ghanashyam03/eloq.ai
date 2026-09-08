import { MetricSummary, MetricSummarySchema } from "@/domain/evaluation/evaluation.schema";

export interface TestPredictionResult {
  testCaseId: string;
  isCompletelyCorrectExpected: boolean;
  isCompletelyCorrectPredicted: boolean;
  detectedIssueCount: number;
}

export class EvaluationMetricsEngine {
  /**
   * Calculates deterministic precision, recall, F1, FPR, and FNR from test predictions.
   */
  calculateMetrics(results: TestPredictionResult[]): MetricSummary {
    let truePositives = 0; // Correctly identified error case
    let falsePositives = 0; // Incorrectly flagged valid case as error
    let trueNegatives = 0; // Correctly identified valid case
    let falseNegatives = 0; // Missed actual error case

    for (const r of results) {
      const isErrorExpected = !r.isCompletelyCorrectExpected;
      const isErrorPredicted = !r.isCompletelyCorrectPredicted || r.detectedIssueCount > 0;

      if (isErrorExpected && isErrorPredicted) {
        truePositives++;
      } else if (!isErrorExpected && isErrorPredicted) {
        falsePositives++;
      } else if (!isErrorExpected && !isErrorPredicted) {
        trueNegatives++;
      } else if (isErrorExpected && !isErrorPredicted) {
        falseNegatives++;
      }
    }

    const totalCases = results.length;
    const precisionDenominator = truePositives + falsePositives;
    const precision = precisionDenominator > 0 ? truePositives / precisionDenominator : 1.0;

    const recallDenominator = truePositives + falseNegatives;
    const recall = recallDenominator > 0 ? truePositives / recallDenominator : 1.0;

    const f1Denominator = precision + recall;
    const f1 = f1Denominator > 0 ? (2 * precision * recall) / f1Denominator : 0.0;

    const fprDenominator = falsePositives + trueNegatives;
    const falsePositiveRate = fprDenominator > 0 ? falsePositives / fprDenominator : 0.0;

    const fnrDenominator = falseNegatives + truePositives;
    const falseNegativeRate = fnrDenominator > 0 ? falseNegatives / fnrDenominator : 0.0;

    const accuracy = totalCases > 0 ? (truePositives + trueNegatives) / totalCases : 1.0;

    const summary: MetricSummary = {
      totalCases,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1: parseFloat(f1.toFixed(4)),
      falsePositiveRate: parseFloat(falsePositiveRate.toFixed(4)),
      falseNegativeRate: parseFloat(falseNegativeRate.toFixed(4)),
      accuracy: parseFloat(accuracy.toFixed(4)),
    };

    return MetricSummarySchema.parse(summary);
  }
}

export const evaluationMetricsEngine = new EvaluationMetricsEngine();
