import { z } from "zod";

export const WritingRegisterSchema = z.enum([
  "casual",
  "neutral",
  "professional",
  "academic",
  "formal",
]);
export type WritingRegister = z.infer<typeof WritingRegisterSchema>;

export const CorrectionLayerTypeSchema = z.enum([
  "grammar_correctness", // Layer 1: Objective grammatical & correctness errors
  "naturalness", // Layer 2: Idiomatic & native-like phrasing
  "style_clarity", // Layer 3: Conciseness, flow, and sentence structure
  "advanced_refinement", // Layer 4: Sophisticated register & tone polishing
]);
export type CorrectionLayerType = z.infer<typeof CorrectionLayerTypeSchema>;

/**
 * Individual Writing Issue in one of the 4 correction layers.
 */
export const WritingIssueSchema = z.object({
  id: z.string().uuid(),
  layer: CorrectionLayerTypeSchema,
  originalText: z.string(),
  correctedText: z.string(),
  category: z.enum([
    "GRAMMAR",
    "VOCABULARY",
    "NATURALNESS",
    "CLARITY",
    "COHERENCE",
    "ORGANIZATION",
    "REGISTER",
    "CONCISENESS",
    "REPETITION",
  ]),
  subcategory: z.string(),
  reason: z.string(), // Pedagogical explanation
  severity: z.number().int().min(1).max(5).default(2),
  confidence: z.number().min(0.0).max(1.0).default(0.85),
});
export type WritingIssue = z.infer<typeof WritingIssueSchema>;

/**
 * Modality & Meaning Preservation Audit Result.
 */
export const ModalityMeaningAuditSchema = z.object({
  isMeaningPreserved: z.boolean(),
  confidenceScore: z.number().min(0.0).max(1.0),
  modalityShiftsDetected: z.array(
    z.object({
      originalModal: z.string(),
      rewriteModal: z.string(),
      explanation: z.string(),
    })
  ).default([]),
  factualDifferenceNote: z.string().optional(),
});
export type ModalityMeaningAudit = z.infer<typeof ModalityMeaningAuditSchema>;

/**
 * Complete Writing Analysis Result (preserves original text, 4 unmixed layers).
 */
export const WritingAnalysisResultSchema = z.object({
  analysisId: z.string().uuid(),
  originalText: z.string(),
  detectedRegister: WritingRegisterSchema,
  targetRegister: WritingRegisterSchema,
  wordCount: z.number().int().nonnegative(),
  // 4 Explicit Correction Layers
  layer1GrammarCorrectness: z.array(WritingIssueSchema).default([]),
  layer2Naturalness: z.array(WritingIssueSchema).default([]),
  layer3StyleClarity: z.array(WritingIssueSchema).default([]),
  layer4AdvancedRefinement: z.array(WritingIssueSchema).default([]),
  // Overall Writing Dimension Metrics (0.0 to 10.0 scale)
  metrics: z.object({
    grammarScore: z.number().min(0).max(10).default(8.0),
    vocabularyScore: z.number().min(0).max(10).default(7.5),
    naturalnessScore: z.number().min(0).max(10).default(7.5),
    clarityScore: z.number().min(0).max(10).default(8.0),
    concisenessScore: z.number().min(0).max(10).default(8.0),
    coherenceScore: z.number().min(0).max(10).default(8.0),
  }),
  usefulVocabularyExtracted: z.array(z.string()).default([]),
  misusedVocabularyRecorded: z.array(z.string()).default([]),
  analyzedAt: z.date(),
});
export type WritingAnalysisResult = z.infer<typeof WritingAnalysisResultSchema>;

/**
 * Rewrite Result Schema.
 */
export const WritingRewriteResultSchema = z.object({
  rewriteId: z.string().uuid(),
  originalText: z.string(),
  rewriteMode: z.enum(["corrected", "natural", "professional", "academic"]),
  rewrittenText: z.string(),
  meaningAudit: ModalityMeaningAuditSchema,
  keyChangesSummary: z.array(z.string()).default([]),
  generatedAt: z.date(),
});
export type WritingRewriteResult = z.infer<typeof WritingRewriteResultSchema>;
