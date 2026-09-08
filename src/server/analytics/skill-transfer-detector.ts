import { SkillTransferGap } from "@/domain/progress/progress-analytics.schema";

export interface SkillPerformanceComparison {
  conceptOrCategory: string;
  controlledExerciseAccuracy: number; // 0 to 100%
  spontaneousErrorCount: number;
  spontaneousWordsProduced: number;
}

export class SkillTransferDetector {
  /**
   * Detects skill transfer gaps where user demonstrates high accuracy in controlled exercises
   * but continues to struggle with the concept during uninhibited spontaneous speaking.
   */
  public detectTransferGaps(comparisons: SkillPerformanceComparison[]): SkillTransferGap[] {
    const gaps: SkillTransferGap[] = [];

    for (const comp of comparisons) {
      if (comp.spontaneousWordsProduced < 50) {
        continue; // Insufficient spontaneous words to measure transfer gap reliably
      }

      const spontaneousRatePer1000 = Math.round(
        (comp.spontaneousErrorCount / comp.spontaneousWordsProduced) * 1000 * 10
      ) / 10;

      // Transfer Gap Condition: Controlled exercise accuracy >= 75%, but spontaneous error rate >= 6 per 1000 words
      if (comp.controlledExerciseAccuracy >= 75 && spontaneousRatePer1000 >= 6.0) {
        let gapSeverity: "minor" | "moderate" | "severe" = "minor";
        if (spontaneousRatePer1000 >= 15.0 || comp.controlledExerciseAccuracy >= 90) {
          gapSeverity = "severe";
        } else if (spontaneousRatePer1000 >= 10.0) {
          gapSeverity = "moderate";
        }

        gaps.push({
          conceptOrCategory: comp.conceptOrCategory,
          controlledExerciseAccuracy: comp.controlledExerciseAccuracy,
          spontaneousErrorRatePer1000Words: spontaneousRatePer1000,
          gapSeverity,
          insightMessage: `Controlled exercise accuracy for '${comp.conceptOrCategory}' is high (${Math.round(comp.controlledExerciseAccuracy)}%), but spontaneous error rate remains elevated (${spontaneousRatePer1000} per 1,000 words). Focus on spontaneous production practice.`,
        });
      }
    }

    return gaps;
  }
}

export const skillTransferDetector = new SkillTransferDetector();
