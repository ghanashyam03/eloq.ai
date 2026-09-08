export class NormalizedMetricsEngine {
  /**
   * Calculates normalized error rate per 1,000 words produced.
   */
  public calculateErrorsPer1000Words(totalErrors: number, totalWordsProduced: number): number {
    if (totalWordsProduced <= 0) return 0.0;
    return Math.round((totalErrors / totalWordsProduced) * 1000 * 100) / 100;
  }

  /**
   * Calculates normalized hesitation filler frequency per minute of spoken audio.
   */
  public calculateFillersPerMinute(totalFillers: number, speakingDurationSeconds: number): number {
    if (speakingDurationSeconds <= 0) return 0.0;
    const durationMinutes = speakingDurationSeconds / 60;
    return Math.round((totalFillers / durationMinutes) * 100) / 100;
  }

  /**
   * Calculates filler frequency per 100 words produced.
   */
  public calculateFillersPer100Words(totalFillers: number, totalWordsProduced: number): number {
    if (totalWordsProduced <= 0) return 0.0;
    return Math.round((totalFillers / totalWordsProduced) * 100 * 100) / 100;
  }

  /**
   * Calculates active-to-passive vocabulary conversion ratio (0.0 to 1.0).
   */
  public calculateActiveToPassiveRatio(activeCount: number, passiveCount: number): number {
    const total = activeCount + passiveCount;
    if (total <= 0) return 0.0;
    return Math.round((activeCount / total) * 100) / 100;
  }
}

export const normalizedMetricsEngine = new NormalizedMetricsEngine();
