import { TrendState } from "@/domain/progress/progress-analytics.schema";

export interface MeasurementDataPoint {
  timestamp: Date;
  value: number; // e.g. error rate per 1000 words or accuracy percentage
  weight?: number;
}

export class TrendCalculator {
  /**
   * Calculates volume-backed confidence rating between 0.0 and 1.0 based on evidence count.
   */
  public calculateConfidence(evidenceCount: number): number {
    if (evidenceCount <= 0) return 0.0;
    if (evidenceCount < 10) return Math.round(Math.min(evidenceCount / 25, 0.3) * 100) / 100;
    if (evidenceCount <= 50) return Math.round((0.3 + ((evidenceCount - 10) / 40) * 0.4) * 100) / 100;
    return Math.round(Math.min(0.7 + ((evidenceCount - 50) / 200) * 0.3, 1.0) * 100) / 100;
  }

  /**
   * Calculates trend state ('improving', 'stable', 'declining', 'insufficient_evidence')
   * across chronologically ordered measurement data points.
   *
   * @param points Chronologically ordered array of data points.
   * @param lowerIsBetter Set true for error rates (where a lower value means improvement).
   * @param minSessions Minimum distinct sessions required to consider trend statistically valid (default: 3).
   */
  public calculateTrend(
    points: MeasurementDataPoint[],
    lowerIsBetter = false,
    minSessions = 3
  ): TrendState {
    if (!points || points.length < 5) {
      return "insufficient_evidence";
    }

    // Check distinct session timestamps
    const distinctDates = new Set(points.map((p) => p.timestamp.toISOString().split("T")[0]));
    if (distinctDates.size < minSessions) {
      return "insufficient_evidence";
    }

    // Sort points chronologically
    const sorted = [...points].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Dampen isolated single-session spikes before half comparison
    const cleanedValues = sorted.map((p, i) => {
      const val = p.value;
      if (i > 0 && i < sorted.length - 1) {
        const prev = sorted[i - 1]!.value;
        const next = sorted[i + 1]!.value;
        const neighborAvg = (prev + next) / 2;
        if (val > neighborAvg * 2.5 && Math.abs(prev - next) <= neighborAvg * 0.5 + 2) {
          return neighborAvg;
        }
      }
      return val;
    });

    // Split points into earlier half vs recent half
    const half = Math.floor(cleanedValues.length / 2);
    const earlierHalf = cleanedValues.slice(0, half);
    const recentHalf = cleanedValues.slice(half);

    const avgEarlier = earlierHalf.reduce((sum, v) => sum + v, 0) / earlierHalf.length;
    const avgRecent = recentHalf.reduce((sum, v) => sum + v, 0) / recentHalf.length;

    const base = Math.max(Math.abs(avgEarlier), 0.001);
    const relativeChange = (avgRecent - avgEarlier) / base; // positive if recent > earlier

    // Threshold delta: 5% relative change
    const deltaThreshold = 0.05;

    if (lowerIsBetter) {
      // For error rates: negative relativeChange means error rate dropped -> improving
      if (relativeChange < -deltaThreshold) return "improving";
      if (relativeChange > deltaThreshold) return "declining";
      return "stable";
    } else {
      // For scores/accuracy: positive relativeChange means score increased -> improving
      if (relativeChange > deltaThreshold) return "improving";
      if (relativeChange < -deltaThreshold) return "declining";
      return "stable";
    }
  }
}

export const trendCalculator = new TrendCalculator();
