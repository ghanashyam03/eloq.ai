import { ConfidenceBucket } from "@/domain/evaluation/evaluation.schema";

export interface PredictionConfidenceItem {
  confidence: number; // 0.0 to 1.0
  isEmpiricallyCorrect: boolean;
}

export interface CalibrationResult {
  buckets: ConfidenceBucket[];
  expectedCalibrationError: number;
}

export class ConfidenceCalibrator {
  private static BUCKETS = [
    { name: "0.0-0.2", min: 0.0, max: 0.2 },
    { name: "0.2-0.4", min: 0.2, max: 0.4 },
    { name: "0.4-0.6", min: 0.4, max: 0.6 },
    { name: "0.6-0.8", min: 0.6, max: 0.8 },
    { name: "0.8-1.0", min: 0.8, max: 1.0 },
  ];

  /**
   * Buckets predictions across confidence intervals and calculates Expected Calibration Error (ECE).
   */
  evaluateCalibration(items: PredictionConfidenceItem[]): CalibrationResult {
    const totalPredictions = items.length;
    const bucketResults: ConfidenceBucket[] = [];
    let weightedCalibrationErrorSum = 0;

    for (const b of ConfidenceCalibrator.BUCKETS) {
      const bucketItems = items.filter(
        (item) => item.confidence >= b.min && (item.confidence < b.max || (b.max === 1.0 && item.confidence <= 1.0))
      );

      const count = bucketItems.length;
      if (count === 0) {
        bucketResults.push({
          bucket: b.name,
          minConfidence: b.min,
          maxConfidence: b.max,
          totalPredictions: 0,
          correctPredictions: 0,
          averageConfidence: parseFloat(((b.min + b.max) / 2).toFixed(2)),
          observedAccuracy: 0.0,
          calibrationError: 0.0,
        });
        continue;
      }

      const correctCount = bucketItems.filter((i) => i.isEmpiricallyCorrect).length;
      const sumConfidence = bucketItems.reduce((acc, i) => acc + i.confidence, 0);

      const averageConfidence = parseFloat((sumConfidence / count).toFixed(4));
      const observedAccuracy = parseFloat((correctCount / count).toFixed(4));
      const calibrationError = parseFloat(Math.abs(averageConfidence - observedAccuracy).toFixed(4));

      if (totalPredictions > 0) {
        weightedCalibrationErrorSum += (count / totalPredictions) * calibrationError;
      }

      bucketResults.push({
        bucket: b.name,
        minConfidence: b.min,
        maxConfidence: b.max,
        totalPredictions: count,
        correctPredictions: correctCount,
        averageConfidence,
        observedAccuracy,
        calibrationError,
      });
    }

    const expectedCalibrationError = parseFloat(weightedCalibrationErrorSum.toFixed(4));

    return {
      buckets: bucketResults,
      expectedCalibrationError,
    };
  }
}

export const confidenceCalibrator = new ConfidenceCalibrator();
