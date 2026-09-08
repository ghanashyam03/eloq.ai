import { z } from "zod";

export const ActivityTypeSchema = z.enum([
  "retrieval_review",
  "targeted_remediation",
  "new_skill_learning",
  "spontaneous_speaking",
  "writing_production",
  "reading_comprehension",
  "listening_shadowing",
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const PrimaryFactorSchema = z.enum([
  "high_recurrence_weakness",
  "srs_decay_review",
  "active_production_gap",
  "fluency_spontaneous_need",
  "goal_alignment",
  "new_skill_progression",
  "diagnostic_baseline",
]);
export type PrimaryFactor = z.infer<typeof PrimaryFactorSchema>;

export const SelectionReasonSchema = z.object({
  primaryFactor: PrimaryFactorSchema,
  weaknessRecurrence: z.number().min(0).max(10).optional(),
  severityScore: z.number().min(0).max(10).optional(),
  decayScore: z.number().min(0).max(10).optional(),
  goalRelevance: z.number().min(0).max(10).optional(),
  explanationText: z.string(),
});
export type SelectionReason = z.infer<typeof SelectionReasonSchema>;

export const TargetCategorySchema = z.enum([
  "grammar",
  "vocabulary",
  "pronunciation",
  "fluency",
  "reading",
  "listening",
  "writing",
]);
export type TargetCategory = z.infer<typeof TargetCategorySchema>;

export const CurriculumActivitySchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().positive(),
  activityType: ActivityTypeSchema,
  targetSkill: z.string(),
  targetCategory: TargetCategorySchema,
  objectives: z.array(z.string()),
  durationMinutes: z.number().positive(),
  difficulty: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  reason: SelectionReasonSchema,
  exerciseConfig: z.record(z.string(), z.unknown()).default({}),
});
export type CurriculumActivity = z.infer<typeof CurriculumActivitySchema>;

export const DailyCurriculumPlanSchema = z.object({
  planId: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string(), // ISO YYYY-MM-DD format
  totalDurationMinutes: z.number().positive(),
  balanceDistribution: z.object({
    remediationPercent: z.number().nonnegative().max(100),
    maintenancePercent: z.number().nonnegative().max(100),
    newLearningPercent: z.number().nonnegative().max(100),
    spontaneousPercent: z.number().nonnegative().max(100),
  }),
  activities: z.array(CurriculumActivitySchema),
  generatedAt: z.date(),
  adaptedCount: z.number().int().nonnegative().default(0),
});
export type DailyCurriculumPlan = z.infer<typeof DailyCurriculumPlanSchema>;
