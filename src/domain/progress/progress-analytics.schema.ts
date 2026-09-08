import { z } from "zod";

export const SCORING_VERSION = "progress.v1";

export const TrendStateSchema = z.enum([
  "improving",
  "stable",
  "declining",
  "insufficient_evidence",
]);
export type TrendState = z.infer<typeof TrendStateSchema>;

export const WindowSchema = z.enum(["7d", "30d", "90d"]);
export type Window = z.infer<typeof WindowSchema>;

export const PerformanceDimensionSchema = z.enum([
  "grammar",
  "vocabulary",
  "activeVocabulary",
  "fluency",
  "naturalness",
  "pronunciation",
  "listening",
  "reading",
  "writing",
  "coherence",
]);
export type PerformanceDimension = z.infer<typeof PerformanceDimensionSchema>;

export const RawEvidenceMetricsSchema = z.object({
  totalSessionsCount: z.number().int().nonnegative(),
  totalTurnsCount: z.number().int().nonnegative(),
  totalWordsProduced: z.number().int().nonnegative(),
  totalSpeakingDurationSeconds: z.number().nonnegative(),
  totalErrorsObserved: z.number().int().nonnegative(),
  totalFillersObserved: z.number().int().nonnegative(),
  totalPausesObserved: z.number().int().nonnegative(),
  totalSuccessfulAttempts: z.number().int().nonnegative(),
  totalFailedAttempts: z.number().int().nonnegative(),
  anomalyFilteredSessionsCount: z.number().int().nonnegative().default(0),
});
export type RawEvidenceMetrics = z.infer<typeof RawEvidenceMetricsSchema>;

export const DimensionProgressSchema = z.object({
  dimension: PerformanceDimensionSchema,
  currentScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0.0).max(1.0),
  evidenceVolume: z.number().int().nonnegative(),
  trend: TrendStateSchema,
  scoringVersion: z.string().default(SCORING_VERSION),
  ratesPer1000Words: z.number().nonnegative().optional(),
  ratePerMinute: z.number().nonnegative().optional(),
});
export type DimensionProgress = z.infer<typeof DimensionProgressSchema>;

export const VocabularyGrowthProgressSchema = z.object({
  encounteredCount: z.number().int().nonnegative(),
  recognizedCount: z.number().int().nonnegative(),
  recalledCount: z.number().int().nonnegative(),
  successfullyProducedCount: z.number().int().nonnegative(),
  naturallyUsedCount: z.number().int().nonnegative(),
  activeToPassiveRatio: z.number().min(0).max(1),
});
export type VocabularyGrowthProgress = z.infer<typeof VocabularyGrowthProgressSchema>;

export const SkillTransferGapSchema = z.object({
  conceptOrCategory: z.string(),
  controlledExerciseAccuracy: z.number().min(0).max(100),
  spontaneousErrorRatePer1000Words: z.number().nonnegative(),
  gapSeverity: z.enum(["minor", "moderate", "severe"]),
  insightMessage: z.string(),
});
export type SkillTransferGap = z.infer<typeof SkillTransferGapSchema>;

export const PersonalInsightSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(["comparison", "trend", "transfer_gap", "vocabulary", "fluency"]),
  headline: z.string(),
  detailedObservation: z.string(),
  supportingEvidence: z.record(z.string(), z.unknown()),
  generatedAt: z.date(),
});
export type PersonalInsight = z.infer<typeof PersonalInsightSchema>;

export const UserProgressReportSchema = z.object({
  reportId: z.string().uuid(),
  userId: z.string().uuid(),
  window: WindowSchema,
  scoringVersion: z.string().default(SCORING_VERSION),
  rawEvidence: RawEvidenceMetricsSchema,
  dimensions: z.record(PerformanceDimensionSchema, DimensionProgressSchema),
  vocabularyGrowth: VocabularyGrowthProgressSchema,
  transferGaps: z.array(SkillTransferGapSchema),
  strengths: z.array(z.string()),
  activeWeaknesses: z.array(z.string()),
  improvingWeaknesses: z.array(z.string()),
  persistentWeaknesses: z.array(z.string()),
  relapsedWeaknesses: z.array(z.string()),
  practiceConsistency: z.object({
    activeDaysCount: z.number().int().nonnegative(),
    totalSessionsCount: z.number().int().nonnegative(),
    averageMinutesPerDay: z.number().nonnegative(),
  }),
  personalInsights: z.array(PersonalInsightSchema),
  recommendedFocus: z.array(z.string()),
  generatedAt: z.date(),
});
export type UserProgressReport = z.infer<typeof UserProgressReportSchema>;
