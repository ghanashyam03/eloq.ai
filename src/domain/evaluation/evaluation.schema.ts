import { z } from "zod";

export const GoldStandardTestCaseSchema = z.object({
  id: z.string(),
  category: z.enum([
    "grammar_article",
    "grammar_preposition",
    "grammar_tense",
    "grammar_agreement",
    "grammar_conditional",
    "grammar_word_order",
    "grammar_pronoun",
    "grammar_determiner",
    "naturalness_unnatural",
    "naturalness_formal",
    "naturalness_informal",
    "vocabulary_misuse",
    "vocabulary_collocation",
    "vocabulary_vague",
    "fluency_fillers",
    "fluency_pauses",
    "clearly_correct",
    "clearly_incorrect",
    "ambiguous",
    "dialect_variant",
  ]),
  input: z.string().min(1),
  englishVariety: z.string().default("en-US"),
  expectedClassification: z.string(),
  expectedIssues: z
    .array(
      z.object({
        category: z.string(),
        subcategory: z.string(),
        originalTextSnippet: z.string().optional(),
        acceptableCorrections: z.array(z.string()),
      })
    )
    .default([]),
  shouldBeCompletelyCorrect: z.boolean(),
  difficulty: z.string().default("intermediate"),
});
export type GoldStandardTestCase = z.infer<typeof GoldStandardTestCaseSchema>;

export const MetricSummarySchema = z.object({
  totalCases: z.number().int().nonnegative(),
  truePositives: z.number().int().nonnegative(),
  falsePositives: z.number().int().nonnegative(),
  trueNegatives: z.number().int().nonnegative(),
  falseNegatives: z.number().int().nonnegative(),
  precision: z.number().min(0.0).max(1.0),
  recall: z.number().min(0.0).max(1.0),
  f1: z.number().min(0.0).max(1.0),
  falsePositiveRate: z.number().min(0.0).max(1.0),
  falseNegativeRate: z.number().min(0.0).max(1.0),
  accuracy: z.number().min(0.0).max(1.0),
});
export type MetricSummary = z.infer<typeof MetricSummarySchema>;

export const ConfidenceBucketSchema = z.object({
  bucket: z.string(), // e.g. "0.8-1.0"
  minConfidence: z.number(),
  maxConfidence: z.number(),
  totalPredictions: z.number().int().nonnegative(),
  correctPredictions: z.number().int().nonnegative(),
  averageConfidence: z.number().min(0.0).max(1.0),
  observedAccuracy: z.number().min(0.0).max(1.0),
  calibrationError: z.number().min(0.0),
});
export type ConfidenceBucket = z.infer<typeof ConfidenceBucketSchema>;

export const RegressionReportSchema = z.object({
  promptVersion: z.string(),
  previousPromptVersion: z.string().optional(),
  provider: z.string(),
  currentMetrics: MetricSummarySchema,
  previousMetrics: MetricSummarySchema.optional(),
  precisionDelta: z.number(),
  recallDelta: z.number(),
  fprDelta: z.number(),
  regressions: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
});
export type RegressionReport = z.infer<typeof RegressionReportSchema>;

export const DimensionScoreSchema = z.object({
  dimension: z.enum([
    "grammar",
    "vocabulary",
    "fluency",
    "naturalness",
    "pronunciation",
    "coherence",
    "speaking",
  ]),
  version: z.string(), // e.g. "grammarScore.v1"
  value: z.number().min(0.0).max(100.0).nullable(),
  evidenceCount: z.number().int().nonnegative(),
  confidence: z.number().min(0.0).max(1.0),
  hasEnoughEvidence: z.boolean(),
  statusText: z.string(),
  calculatedAt: z.date(),
});
export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

export const EvaluationReportSchema = z.object({
  title: z.string(),
  generatedAt: z.date(),
  promptVersion: z.string(),
  provider: z.string(),
  metrics: MetricSummarySchema,
  calibrationBuckets: z.array(ConfidenceBucketSchema),
  expectedCalibrationError: z.number(),
  regressionReport: RegressionReportSchema.optional(),
  adaptiveScenariosPassed: z.boolean(),
  knownLimitations: z.array(z.string()),
  markdownContent: z.string(),
});
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;
