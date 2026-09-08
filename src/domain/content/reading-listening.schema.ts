import { z } from "zod";

export const ContentSourceTypeSchema = z.enum([
  "pasted",
  "user_created",
  "generated_passage",
  "imported_article",
]);
export type ContentSourceType = z.infer<typeof ContentSourceTypeSchema>;

export const QuestionTypeSchema = z.enum([
  "explicit_information",
  "inference",
  "main_idea",
  "vocabulary_in_context",
  "reasoning",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

/**
 * Comprehension Question schema for reading & listening.
 */
export const ComprehensionQuestionSchema = z.object({
  id: z.string().uuid(),
  type: QuestionTypeSchema,
  questionText: z.string(),
  options: z.array(z.string()).optional(), // If multiple choice
  referenceAnswer: z.string(),
  acceptableConcepts: z.array(z.string()).default([]), // For semantic equivalence
  explanation: z.string(),
});
export type ComprehensionQuestion = z.infer<typeof ComprehensionQuestionSchema>;

/**
 * Encountered Vocabulary item extracted from content.
 */
export const EncounteredVocabSchema = z.object({
  word: z.string(),
  contextSentence: z.string(),
  definition: z.string().optional(),
  suggestedUpgrade: z.string().optional(),
});
export type EncounteredVocab = z.infer<typeof EncounteredVocabSchema>;

/**
 * Processed Reading Content Item.
 */
export const ReadingContentItemSchema = z.object({
  id: z.string().uuid(),
  sourceType: ContentSourceTypeSchema,
  title: z.string(),
  passageText: z.string(),
  wordCount: z.number().int().positive(),
  estimatedDifficulty: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).default("B2"),
  encounteredVocabulary: z.array(EncounteredVocabSchema).default([]),
  grammarObservations: z.array(z.string()).default([]),
  sentenceExplanations: z.array(z.object({ sentence: z.string(), explanation: z.string() })).default([]),
  questions: z.array(ComprehensionQuestionSchema).min(1),
  summaryPrompt: z.string(),
  discussionPrompts: z.array(z.string()).default([]),
  createdAt: z.date(),
});
export type ReadingContentItem = z.infer<typeof ReadingContentItemSchema>;

/**
 * Listening difficulty factors.
 */
export const ListeningDifficultyFactorsSchema = z.object({
  speechRateWpm: z.number().positive().nullable(),
  vocabularyComplexity: z.enum(["low", "medium", "high"]).default("medium"),
  sentenceComplexity: z.enum(["low", "medium", "high"]).default("medium"),
  topicFamiliarity: z.enum(["familiar", "moderate", "unfamiliar"]).default("moderate"),
  accentVariety: z.string().default("en-US"),
});
export type ListeningDifficultyFactors = z.infer<typeof ListeningDifficultyFactorsSchema>;

/**
 * Processed Listening Content Item.
 */
export const ListeningContentItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  audioUrl: z.string().optional(),
  audioDurationSeconds: z.number().positive().nullable(),
  transcriptionText: z.string(),
  isTranscriptHidden: z.boolean().default(true),
  difficultyFactors: ListeningDifficultyFactorsSchema,
  encounteredVocabulary: z.array(EncounteredVocabSchema).default([]),
  questions: z.array(ComprehensionQuestionSchema).min(1),
  shadowingItemId: z.string().optional(), // Link to shadowing exercise
  createdAt: z.date(),
});
export type ListeningContentItem = z.infer<typeof ListeningContentItemSchema>;

/**
 * Evaluated Answer Schema.
 */
export const ComprehensionAnswerEvaluationSchema = z.object({
  questionId: z.string().uuid(),
  isCorrect: z.boolean(),
  isSemanticallyEquivalent: z.boolean(),
  scorePercentage: z.number().min(0.0).max(100.0),
  feedback: z.string(),
  userAnswer: z.string(),
  referenceAnswer: z.string(),
  matchedConcepts: z.array(z.string()).default([]),
  missingConcepts: z.array(z.string()).default([]),
});
export type ComprehensionAnswerEvaluation = z.infer<typeof ComprehensionAnswerEvaluationSchema>;

/**
 * Transcript Reveal Details Payload.
 */
export const TranscriptRevealPayloadSchema = z.object({
  listeningItemId: z.string().uuid(),
  fullTranscript: z.string(),
  highlightedVocabulary: z.array(EncounteredVocabSchema),
  highlightedExpressions: z.array(z.string()),
  missedKeyInformation: z.array(z.string()),
});
export type TranscriptRevealPayload = z.infer<typeof TranscriptRevealPayloadSchema>;
