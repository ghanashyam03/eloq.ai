import { DimensionScore, DimensionScoreSchema } from "@/domain/evaluation/evaluation.schema";

export interface RawEvidencePayload {
  dimension: "grammar" | "vocabulary" | "fluency" | "naturalness" | "pronunciation" | "coherence" | "speaking";
  totalAttempts: number;
  successfulAttempts: number;
  errorCount: number;
  averageConfidence: number;
}

export class MultiDimensionalScoreEngine {
  private static MINIMUM_EVIDENCE_THRESHOLD = 3;
  private static SCORE_VERSION = "v1";

  /**
   * Calculates a versioned, evidence-backed multi-dimensional score.
   * Enforces minimum sample size threshold (N >= 3) to prevent fake certainty.
   */
  calculateDimensionScore(evidence: RawEvidencePayload): DimensionScore {
    const version = `${evidence.dimension}Score.${MultiDimensionalScoreEngine.SCORE_VERSION}`;

    if (evidence.totalAttempts < MultiDimensionalScoreEngine.MINIMUM_EVIDENCE_THRESHOLD) {
      return DimensionScoreSchema.parse({
        dimension: evidence.dimension,
        version,
        value: null,
        evidenceCount: evidence.totalAttempts,
        confidence: parseFloat(evidence.averageConfidence.toFixed(2)),
        hasEnoughEvidence: false,
        statusText: `Insufficient evidence (${evidence.totalAttempts}/${MultiDimensionalScoreEngine.MINIMUM_EVIDENCE_THRESHOLD} minimum required items)`,
        calculatedAt: new Date(),
      });
    }

    // Formula: Score = max(0, min(100, (successfulAttempts / totalAttempts) * 100 - (errorCount * 2)))
    const rawRatio = evidence.successfulAttempts / Math.max(1, evidence.totalAttempts);
    const scoreVal = Math.max(0, Math.min(100, rawRatio * 100 - evidence.errorCount * 2));
    const value = parseFloat(scoreVal.toFixed(1));

    return DimensionScoreSchema.parse({
      dimension: evidence.dimension,
      version,
      value,
      evidenceCount: evidence.totalAttempts,
      confidence: parseFloat(evidence.averageConfidence.toFixed(2)),
      hasEnoughEvidence: true,
      statusText: `Evidence-backed score calculated from ${evidence.totalAttempts} observations`,
      calculatedAt: new Date(),
    });
  }
}

export const scoreEngine = new MultiDimensionalScoreEngine();
