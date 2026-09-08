import { MetricSummary, RegressionReport, RegressionReportSchema } from "@/domain/evaluation/evaluation.schema";

export class RegressionDetector {
  /**
   * Evaluates prompt or model version performance against baseline metrics to detect regressions or improvements.
   */
  detectRegressions(params: {
    promptVersion: string;
    previousPromptVersion?: string | undefined;
    provider: string;
    currentMetrics: MetricSummary;
    previousMetrics?: MetricSummary | undefined;
  }): RegressionReport {
    const { currentMetrics, previousMetrics } = params;

    if (!previousMetrics) {
      return RegressionReportSchema.parse({
        promptVersion: params.promptVersion,
        ...(params.previousPromptVersion ? { previousPromptVersion: params.previousPromptVersion } : {}),
        provider: params.provider,
        currentMetrics,
        precisionDelta: 0.0,
        recallDelta: 0.0,
        fprDelta: 0.0,
        regressions: [],
        improvements: ["Initial baseline established."],
      });
    }

    const precisionDelta = parseFloat((currentMetrics.precision - previousMetrics.precision).toFixed(4));
    const recallDelta = parseFloat((currentMetrics.recall - previousMetrics.recall).toFixed(4));
    const fprDelta = parseFloat((currentMetrics.falsePositiveRate - previousMetrics.falsePositiveRate).toFixed(4));

    const regressions: string[] = [];
    const improvements: string[] = [];

    // Regression checks
    if (precisionDelta < -0.02) {
      regressions.push(`Precision degraded by ${Math.abs(precisionDelta * 100).toFixed(1)}% (from ${previousMetrics.precision} to ${currentMetrics.precision}).`);
    }
    if (recallDelta < -0.02) {
      regressions.push(`Recall degraded by ${Math.abs(recallDelta * 100).toFixed(1)}% (from ${previousMetrics.recall} to ${currentMetrics.recall}).`);
    }
    if (fprDelta > 0.02) {
      regressions.push(`False Positive Rate increased by ${(fprDelta * 100).toFixed(1)}% (from ${previousMetrics.falsePositiveRate} to ${currentMetrics.falsePositiveRate}). Dangerous for learner feedback.`);
    }

    // Improvement checks
    if (precisionDelta > 0.02) {
      improvements.push(`Precision improved by ${(precisionDelta * 100).toFixed(1)}% (from ${previousMetrics.precision} to ${currentMetrics.precision}).`);
    }
    if (recallDelta > 0.02) {
      improvements.push(`Recall improved by ${(recallDelta * 100).toFixed(1)}% (from ${previousMetrics.recall} to ${currentMetrics.recall}).`);
    }
    if (fprDelta < -0.02) {
      improvements.push(`False Positive Rate reduced by ${Math.abs(fprDelta * 100).toFixed(1)}% (from ${previousMetrics.falsePositiveRate} to ${currentMetrics.falsePositiveRate}).`);
    }

    return RegressionReportSchema.parse({
      promptVersion: params.promptVersion,
      ...(params.previousPromptVersion ? { previousPromptVersion: params.previousPromptVersion } : {}),
      provider: params.provider,
      currentMetrics,
      previousMetrics,
      precisionDelta,
      recallDelta,
      fprDelta,
      regressions,
      improvements,
    });
  }
}

export const regressionDetector = new RegressionDetector();
