import { z } from "zod";

export const SimulationTypeSchema = z.enum([
  "interview",
  "debate",
  "presentation",
  "roleplay",
  "academic_discussion",
  "professional_scenario",
]);
export type SimulationType = z.infer<typeof SimulationTypeSchema>;

export const RoleTypeSchema = z.enum([
  "interviewer",
  "debater",
  "presentation_audience",
  "professor",
  "manager",
  "client",
  "coworker",
  "conference_participant",
]);
export type RoleType = z.infer<typeof RoleTypeSchema>;

/**
 * Role configuration specifying AI behavior, tone, and constraints.
 */
export const RoleConfigurationSchema = z.object({
  aiRole: RoleTypeSchema,
  userRole: z.string(),
  tone: z.enum(["professional", "challenging", "academic", "collaborative", "formal", "casual"]),
  behavioralRules: z.array(z.string()).default([]),
  opposingStance: z.string().optional(), // For debate mode
});
export type RoleConfiguration = z.infer<typeof RoleConfigurationSchema>;

/**
 * Scenario Definition object configuring a simulation session.
 */
export const ScenarioDefinitionSchema = z.object({
  id: z.string(),
  type: SimulationTypeSchema,
  title: z.string(),
  objective: z.string(),
  roleConfiguration: RoleConfigurationSchema,
  difficulty: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).default("B2"),
  topic: z.string(),
  constraints: z.array(z.string()).default([]),
  evaluationDimensions: z.array(z.string()).default([
    "relevance",
    "clarity",
    "structure",
    "conciseness",
    "grammar",
    "vocabulary",
    "naturalness",
  ]),
  targetSkills: z.array(z.enum([
    "naturalness",
    "vocabulary",
    "grammar",
    "fluency",
    "professional_english",
    "academic_english",
  ])).default(["naturalness", "fluency"]),
});
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;

/**
 * Session evaluation report generated at simulation conclusion.
 */
export const SimulationSessionReportSchema = z.object({
  reportId: z.string().uuid(),
  sessionId: z.string(),
  userId: z.string().uuid(),
  scenarioId: z.string(),
  simulationType: SimulationTypeSchema,
  topic: z.string(),
  turnCount: z.number().int().nonnegative(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recurringErrors: z.array(z.string()).default([]),
  keyVocabularyUsed: z.array(z.string()).default([]),
  speakingMetrics: z.object({
    averageWpm: z.number().nonnegative().nullable(),
    totalPauses: z.number().int().nonnegative(),
    hesitationFillerCount: z.number().int().nonnegative(),
    repetitionCount: z.number().int().nonnegative(),
  }),
  dimensionScores: z.record(z.string(), z.number().min(0).max(100)).default({}),
  recommendations: z.array(z.string()).default([]),
  evaluatedAt: z.date(),
});
export type SimulationSessionReport = z.infer<typeof SimulationSessionReportSchema>;
