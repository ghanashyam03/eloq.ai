import { z } from "zod";

export const ClassificationStateSchema = z.enum([
  "grammatically_incorrect",
  "unnatural_phrase",
  "grammatically_correct_and_natural",
  "informal_valid",
  "dialect_variant_valid",
  "ambiguous_uncertain",
]);
export type ClassificationState = z.infer<typeof ClassificationStateSchema>;

export const IssueCategorySchema = z.enum([
  "GRAMMAR",
  "VOCABULARY",
  "NATURALNESS",
  "FLUENCY",
  "COHERENCE",
]);
export type IssueCategory = z.infer<typeof IssueCategorySchema>;

export const IssueSubcategorySchema = z.enum([
  // Grammar Subcategories
  "tense",
  "article",
  "preposition",
  "subject_verb_agreement",
  "pronoun",
  "determiner",
  "word_order",
  "modal",
  "conditional",
  "conjunction",
  "clause",
  "agreement",
  // Vocabulary Subcategories
  "incorrect_word",
  "misuse",
  "repetition",
  "vague_word",
  "inappropriate_register",
  "collocation",
  // Naturalness Subcategories
  "awkward_phrase",
  "unnatural_construction",
  "literal_translation",
  "excessive_formality",
  "excessive_informality",
  // Fluency Subcategories
  "filler",
  "hesitation",
  "self_correction",
  "fragmented_speech",
  // Coherence Subcategories
  "unclear_structure",
  "weak_transition",
  "incomplete_explanation",
  "topic_discontinuity",
  "spelling",
  "orthography",
]).catch("incorrect_word");
export type IssueSubcategory = z.infer<typeof IssueSubcategorySchema>;

export const EvidenceSpanSchema = z.object({
  startIndex: z.number().int().nonnegative().optional(),
  endIndex: z.number().int().nonnegative().optional(),
  textSnippet: z.string(),
});
export type EvidenceSpan = z.infer<typeof EvidenceSpanSchema>;

export const LinguisticIssueSchema = z.object({
  id: z.string().uuid(),
  category: IssueCategorySchema,
  subcategory: IssueSubcategorySchema,
  classificationState: ClassificationStateSchema,
  originalText: z.string(),
  correctedText: z.string(),
  naturalAlternative: z.string().optional(),
  explanation: z.string(),
  severity: z.number().int().min(1).max(5).default(2), // 1=minor to 5=critical
  confidence: z.number().min(0.0).max(1.0).default(0.8),
  evidenceSpan: EvidenceSpanSchema,
  uncertaintyState: z.boolean().default(false),
});
export type LinguisticIssue = z.infer<typeof LinguisticIssueSchema>;

export const ConfidenceThresholdsSchema = z.object({
  highConfidence: z.number().default(0.85),
  mediumConfidence: z.number().default(0.60),
});
export type ConfidenceThresholds = z.infer<typeof ConfidenceThresholdsSchema>;

export const DeterministicStatsSchema = z.object({
  wordCount: z.number().int().nonnegative(),
  sentenceCount: z.number().int().nonnegative(),
  typeTokenRatio: z.number().min(0.0).max(1.0),
  fillerCount: z.number().int().nonnegative(),
  detectedFillers: z.array(z.string()),
  wordsPerMinute: z.number().nullable(),
  pauseCount: z.number().int().nullable(),
  totalPauseDurationSecs: z.number().nullable(),
});
export type DeterministicStats = z.infer<typeof DeterministicStatsSchema>;

export const StructuredLinguisticAnalysisSchema = z.object({
  overallSummary: z.string(),
  isCompletelyCorrect: z.boolean().default(false),
  classificationState: ClassificationStateSchema,
  deterministicStats: DeterministicStatsSchema,
  highConfidenceIssues: z.array(LinguisticIssueSchema),
  mediumConfidenceIssues: z.array(LinguisticIssueSchema),
  filteredLowConfidenceCount: z.number().int().nonnegative().default(0),
  usefulVocabularyEncounters: z.array(
    z.object({
      word: z.string(),
      context: z.string(),
      suggestedUpgrade: z.string().optional(),
    })
  ).default([]),
  rawModelResponse: z.string().optional(),
  normalizedCandidateCount: z.number().int().nonnegative().optional(),
  verificationReasons: z.array(z.string()).optional(),
  modelQualityRating: z.string().optional(),
  analyzedAt: z.date(),
});
export type StructuredLinguisticAnalysis = z.infer<typeof StructuredLinguisticAnalysisSchema>;
