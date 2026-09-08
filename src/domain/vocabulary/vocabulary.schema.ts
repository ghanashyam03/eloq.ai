import { z } from "zod";

export const VocabularyStageSchema = z.enum([
  "encountered",
  "recognized",
  "passive",
  "active",
  "mastered",
]);
export type VocabularyStage = z.infer<typeof VocabularyStageSchema>;

export const ReviewTypeSchema = z.enum([
  "recognition",
  "recall",
  "production",
  "contextual_production",
]);
export type ReviewType = z.infer<typeof ReviewTypeSchema>;

export const ExerciseTypeSchema = z.enum([
  "sentence_gap_fill",
  "concept_explanation",
  "question_response",
  "sentence_creation",
  "context_selection",
  "precision_replacement",
]);
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;

export const NaturalnessRatingSchema = z.enum([
  "incorrect",
  "correct_unnatural",
  "correct_natural",
]);
export type NaturalnessRating = z.infer<typeof NaturalnessRatingSchema>;

export const VocabularyEntitySchema = z.object({
  id: z.string().uuid(),
  word: z.string().min(1),
  lemma: z.string(),
  partOfSpeech: z.string(),
  definition: z.string(),
  pronunciation: z.string().optional(),
  ipa: z.string().optional(),
  register: z.string().default("neutral"),
  difficulty: z.string().default("intermediate"),
  collocations: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
  exampleSentences: z.array(z.string()).default([]),
  isModelGenerated: z.boolean().default(true),
});
export type VocabularyEntity = z.infer<typeof VocabularyEntitySchema>;

export const UserVocabularyStateSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  vocabularyItemId: z.string().uuid(),
  encounteredCount: z.number().int().nonnegative().default(0),
  recognizedCount: z.number().int().nonnegative().default(0),
  recalledCount: z.number().int().nonnegative().default(0),
  producedCount: z.number().int().nonnegative().default(0),
  correctProductionCount: z.number().int().nonnegative().default(0),
  incorrectProductionCount: z.number().int().nonnegative().default(0),
  naturalUsageCount: z.number().int().nonnegative().default(0),
  timesMisused: z.number().int().nonnegative().default(0),
  srsIntervalDays: z.number().int().positive().default(1),
  easeFactor: z.number().min(1.3).max(3.5).default(2.5),
  consecutiveSuccesses: z.number().int().nonnegative().default(0),
  mastery: z.number().min(0.0).max(1.0).default(0.0),
  confidence: z.number().min(0.0).max(1.0).default(0.5),
  status: VocabularyStageSchema.default("encountered"),
  lastSeenAt: z.date().nullable(),
  lastReviewedAt: z.date().nullable(),
  nextReviewAt: z.date().nullable(),
});
export type UserVocabularyState = z.infer<typeof UserVocabularyStateSchema>;

export const VocabularyExerciseSchema = z.object({
  id: z.string().uuid(),
  vocabularyItemId: z.string().uuid(),
  word: z.string(),
  lemma: z.string(),
  exerciseType: ExerciseTypeSchema,
  reviewType: ReviewTypeSchema,
  prompt: z.string(),
  instructions: z.string(),
  options: z.array(z.string()).optional(),
  canonicalAnswers: z.array(z.string()),
  targetCollocation: z.string().optional(),
  difficulty: z.string().default("intermediate"),
});
export type VocabularyExercise = z.infer<typeof VocabularyExerciseSchema>;

export const ExerciseEvaluationResultSchema = z.object({
  exerciseId: z.string().uuid(),
  userResponse: z.string(),
  rating: NaturalnessRatingSchema,
  score: z.number().min(0.0).max(1.0),
  feedback: z.string(),
  suggestedAlternative: z.string().optional(),
  isCorrect: z.boolean(),
});
export type ExerciseEvaluationResult = z.infer<typeof ExerciseEvaluationResultSchema>;
