import { WeaknessTrend, WeaknessStatus } from "@/domain/learning/weakness-engine.schema";

export interface PriorityCalculationParams {
  occurrenceCount: number;
  distinctSessionCount: number;
  averageSeverity: number; // 1 to 5
  averageConfidence: number; // 0.0 to 1.0
  lastDetectedAt: Date;
  goalWeight?: number; // Default: 1.0
  trend?: WeaknessTrend;
}

export interface MasteryCalculationParams {
  totalAttempts: number;
  successes: number;
  failures: number;
  spontaneousSuccesses?: number;
  controlledSuccesses?: number;
  lastSuccessAt?: Date | null;
}

export class WeaknessCalculator {
  /**
   * Deterministically calculates priority score using weighted multi-factor formula.
   */
  public calculatePriorityScore(params: PriorityCalculationParams): number {
    const {
      occurrenceCount,
      distinctSessionCount,
      averageSeverity,
      averageConfidence,
      lastDetectedAt,
      goalWeight = 1.0,
      trend = "stable",
    } = params;

    // Filter low confidence noise
    if (averageConfidence < 0.50) {
      return 0.0;
    }

    // 1. Recency Decay (Half-life of 14 days)
    const now = Date.now();
    const daysSinceLast = Math.max(0, (now - lastDetectedAt.getTime()) / (1000 * 60 * 60 * 24));
    const recencyFactor = Math.exp((-0.693 * daysSinceLast) / 14);

    // 2. Frequency & Persistence Weight
    const frequencyWeight = Math.min(10, occurrenceCount * 0.4 + distinctSessionCount * 0.6);

    // 3. Severity Weight (1 to 5 scale normalized to 0.2 - 1.0)
    const severityFactor = averageSeverity / 5.0;

    // 4. Trend Multiplier
    let trendMultiplier = 1.0;
    if (trend === "worsening") trendMultiplier = 1.3;
    if (trend === "improving") trendMultiplier = 0.6;

    const basePriority =
      (frequencyWeight * 0.35 + severityFactor * 10 * 0.25 + recencyFactor * 10 * 0.20 + goalWeight * 10 * 0.20) *
      averageConfidence *
      trendMultiplier;

    return parseFloat(basePriority.toFixed(2));
  }

  /**
   * Deterministically calculates trend classification.
   * Requires a minimum sample size of 3 before assigning directional trends.
   */
  public calculateTrend(occurrenceDates: readonly Date[]): WeaknessTrend {
    if (occurrenceDates.length < 3) {
      return "insufficient_evidence";
    }

    const sorted = [...occurrenceDates].sort((a, b) => a.getTime() - b.getTime());
    const midpointIndex = Math.floor(sorted.length / 2);

    const firstHalf = sorted.slice(0, midpointIndex);
    const secondHalf = sorted.slice(midpointIndex);

    const firstHalfDurationDays = Math.max(
      1,
      (firstHalf[firstHalf.length - 1]!.getTime() - firstHalf[0]!.getTime()) / (1000 * 60 * 60 * 24)
    );
    const secondHalfDurationDays = Math.max(
      1,
      (secondHalf[secondHalf.length - 1]!.getTime() - secondHalf[0]!.getTime()) / (1000 * 60 * 60 * 24)
    );

    const firstHalfRate = firstHalf.length / firstHalfDurationDays;
    const secondHalfRate = secondHalf.length / secondHalfDurationDays;

    if (secondHalfRate < firstHalfRate * 0.7) {
      return "improving";
    }
    if (secondHalfRate > firstHalfRate * 1.3) {
      return "worsening";
    }
    return "stable";
  }

  /**
   * Deterministically estimates user mastery (0.0 to 1.0 / 0% to 100%).
   */
  public calculateMastery(params: MasteryCalculationParams): number {
    const { totalAttempts, successes, spontaneousSuccesses = 0, controlledSuccesses = 0, lastSuccessAt } = params;

    if (totalAttempts === 0) return 0.0;

    // Spontaneous conversation successes carry 1.5x weight over controlled exercises
    const weightedSuccesses = spontaneousSuccesses * 1.5 + controlledSuccesses * 1.0 + (successes - spontaneousSuccesses - controlledSuccesses);
    const rawRatio = weightedSuccesses / Math.max(1, totalAttempts);

    // Apply sample size confidence factor (Full sample confidence reached at 10 attempts)
    const sampleConfidence = Math.min(1.0, totalAttempts / 10.0);
    const baseMastery = rawRatio * sampleConfidence;

    // Recency decay if last success was long ago (>30 days)
    if (lastSuccessAt) {
      const daysSinceSuccess = (Date.now() - lastSuccessAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSuccess > 30) {
        const decay = Math.exp((-0.693 * (daysSinceSuccess - 30)) / 60);
        return parseFloat((baseMastery * decay).toFixed(2));
      }
    }

    return parseFloat(Math.min(1.0, baseMastery).toFixed(2));
  }

  /**
   * Evaluates status transitions: active <-> improving <-> mastered <-> relapsed
   */
  public evaluateStatus(
    mastery: number,
    recentOccurrenceCount: number,
    previouslyMastered: boolean
  ): WeaknessStatus {
    if (mastery >= 0.85 && recentOccurrenceCount === 0) {
      return "mastered";
    }

    if (previouslyMastered && recentOccurrenceCount > 0) {
      return "relapsed";
    }

    if (mastery >= 0.50 && recentOccurrenceCount <= 1) {
      return "improving";
    }

    return "active";
  }
}

export const weaknessCalculator = new WeaknessCalculator();
