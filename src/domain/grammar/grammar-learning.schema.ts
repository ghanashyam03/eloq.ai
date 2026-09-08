import { z } from "zod";

/**
 * Evidence hierarchy distinguishing recognition from spontaneous production.
 */
export const EvidenceLevelSchema = z.enum([
  "recognition", // e.g. multiple choice identification (weight 0.2)
  "controlled_production", // e.g. fill in the blank / transformation (weight 0.5)
  "guided_production", // e.g. sentence construction with prompt (weight 0.7)
  "spontaneous_production", // e.g. unprompted conversational speaking/writing (weight 1.0)
]);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

/**
 * Relapse state transitions for grammar skills.
 */
export const RelapseStateSchema = z.enum([
  "not_started",
  "learning",
  "mastered",
  "inactive",
  "relapse",
  "active_remediation",
]);
export type RelapseState = z.infer<typeof RelapseStateSchema>;

/**
 * Performance trend over recent attempts.
 */
export const SkillTrendSchema = z.enum(["improving", "stable", "declining"]);
export type SkillTrend = z.infer<typeof SkillTrendSchema>;

/**
 * Hierarchical Grammar Skill Node representation.
 */
export const GrammarSkillNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(), // Root category e.g. "Tenses", "Articles"
  parentId: z.string().nullable(),
  subcategories: z.array(z.string()),
  description: z.string(),
  contrastivePartnerId: z.string().optional(), // e.g. simple_past vs present_perfect
});
export type GrammarSkillNode = z.infer<typeof GrammarSkillNodeSchema>;

/**
 * User Mastery Record for a single grammar skill.
 */
export const GrammarSkillMasterySchema = z.object({
  skillId: z.string(),
  userId: z.string().uuid(),
  masteryScore: z.number().min(0.0).max(1.0).default(0.0),
  confidence: z.number().min(0.0).max(1.0).default(0.0),
  evidenceCount: z.number().int().nonnegative().default(0),
  weightedEvidenceScore: z.number().nonnegative().default(0),
  successfulControlledAttempts: z.number().int().nonnegative().default(0),
  successfulOpenAttempts: z.number().int().nonnegative().default(0),
  failures: z.number().int().nonnegative().default(0),
  lastPracticeAt: z.date().nullable().default(null),
  lastSuccessAt: z.date().nullable().default(null),
  currentPriority: z.number().default(5.0),
  trend: SkillTrendSchema.default("stable"),
  relapseState: RelapseStateSchema.default("not_started"),
  srsIntervalDays: z.number().positive().default(1),
  nextReviewAt: z.date(),
});
export type GrammarSkillMastery = z.infer<typeof GrammarSkillMasterySchema>;

/**
 * Personalized User Example from historic conversation evidence.
 */
export const PersonalizedExampleSchema = z.object({
  originalUtterance: z.string(),
  correctedUtterance: z.string(),
  explanation: z.string(),
  context: z.string().optional(),
});
export type PersonalizedExample = z.infer<typeof PersonalizedExampleSchema>;

/**
 * Contrastive Learning Focus comparing confusing forms.
 */
export const ContrastiveFocusSchema = z.object({
  conceptA: z.string(), // e.g. "Simple Past"
  conceptB: z.string(), // e.g. "Present Perfect"
  keyDifference: z.string(),
  exampleA: z.string(),
  exampleB: z.string(),
});
export type ContrastiveFocus = z.infer<typeof ContrastiveFocusSchema>;

/**
 * Structured Exercise Item inside a Grammar Lesson.
 */
export const LessonExerciseSchema = z.object({
  id: z.string(),
  level: EvidenceLevelSchema,
  prompt: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string(),
  explanation: z.string(),
  acceptableAlternatives: z.array(z.string()).default([]),
});
export type LessonExercise = z.infer<typeof LessonExerciseSchema>;

/**
 * Complete Validated AI-Generated Grammar Lesson.
 */
export const GrammarLessonSchema = z.object({
  lessonId: z.string().uuid(),
  skillId: z.string(),
  skillName: z.string(),
  objective: z.string(),
  explanation: z.string(),
  contrastiveFocus: ContrastiveFocusSchema.optional(),
  userPersonalizedExamples: z.array(PersonalizedExampleSchema).default([]),
  generalExamples: z.array(z.string()).default([]),
  controlledExercises: z.array(LessonExerciseSchema).min(1),
  productionExercise: LessonExerciseSchema,
  speakingChallengePrompt: z.string().optional(),
  createdAt: z.date(),
});
export type GrammarLesson = z.infer<typeof GrammarLessonSchema>;

/**
 * Attempt Evaluation Result.
 */
export const AttemptEvaluationResultSchema = z.object({
  attemptId: z.string().uuid(),
  skillId: z.string(),
  isCorrect: z.boolean(),
  evidenceLevel: EvidenceLevelSchema,
  feedback: z.string(),
  userAnswer: z.string(),
  acceptedAnswer: z.string(),
  updatedMastery: GrammarSkillMasterySchema,
});
export type AttemptEvaluationResult = z.infer<typeof AttemptEvaluationResultSchema>;
