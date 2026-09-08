import { z } from "zod";

export const ExerciseTypeSchema = z.enum([
  "correction",
  "multiple_choice",
  "fill_blank",
  "sentence_creation",
  "vocabulary_production",
  "speaking_prompt",
  "grammar_transformation",
  "contextual_usage",
]);
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;

export const ProgressionStageSchema = z.enum([
  "recognition",
  "controlled_production",
  "guided_production",
  "spontaneous_production",
  "real_conversation",
]);
export type ProgressionStage = z.infer<typeof ProgressionStageSchema>;

export const TargetSkillTypeSchema = z.enum([
  "error",
  "grammar",
  "vocabulary",
  "pronunciation",
  "speaking",
]);
export type TargetSkillType = z.infer<typeof TargetSkillTypeSchema>;

export const PracticeExerciseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  exerciseType: ExerciseTypeSchema,
  progressionStage: ProgressionStageSchema,
  targetSkillType: TargetSkillTypeSchema,
  targetCategory: z.string(),
  instructions: z.string(),
  promptText: z.string(),
  expectedAnswer: z.string(),
  canonicalAnswers: z.array(z.string()).default([]),
  options: z.array(z.string()).optional(),
  difficulty: z.string().default("B1"),
  grammarSkillId: z.string().optional(),
  vocabularyItemId: z.string().optional(),
  errorDefinitionId: z.string().optional(),
  selectionReason: z.string(),
  learningObjective: z.string(),
  expectedLearningValue: z.number().min(0.0).default(0.0),
});
export type PracticeExercise = z.infer<typeof PracticeExerciseSchema>;

export const PracticePlanSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  targetFocusArea: z.string(),
  durationMinutes: z.number().int().positive().default(15),
  exercises: z.array(PracticeExerciseSchema),
  planSummary: z.string(),
  generatedAt: z.date(),
});
export type PracticePlan = z.infer<typeof PracticePlanSchema>;

export const AttemptEvaluationSchema = z.object({
  attemptId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  userResponse: z.string(),
  isCorrect: z.boolean(),
  score: z.number().min(0.0).max(1.0),
  feedback: z.string(),
  progressionResult: ProgressionStageSchema,
  difficultyAdjustment: z.enum(["increased", "unchanged", "reduced"]),
  targetSkill: z.string(),
  selectionReason: z.string(),
});
export type AttemptEvaluation = z.infer<typeof AttemptEvaluationSchema>;
