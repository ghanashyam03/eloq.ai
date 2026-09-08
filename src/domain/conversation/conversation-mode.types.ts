import { z } from "zod";

export const ConversationModeSchema = z.enum([
  "casual",
  "free_conversation",
  "academic",
  "professional",
  "interview",
  "debate",
  "presentation",
  "roleplay",
  "academic_discussion",
  "professional_scenario",
]);
export type ConversationMode = z.infer<typeof ConversationModeSchema>;

export const CorrectionModeSchema = z.enum([
  "natural",  // Only correct when communication breaks down
  "balanced", // Correct major errors naturally in response
  "teacher",  // Provide feedback after turn
  "brutal",   // Comprehensive direct feedback on every error without insult
]);
export type CorrectionMode = z.infer<typeof CorrectionModeSchema>;

export const ConversationOptionsSchema = z.object({
  mode: ConversationModeSchema.default("free_conversation"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  correctionMode: CorrectionModeSchema.default("balanced"),
  topicHint: z.string().optional(),
  scenarioId: z.string().optional(),
  targetSkills: z.array(z.string()).default([]),
});
export type ConversationOptions = z.infer<typeof ConversationOptionsSchema>;

export interface PromptContextPayload {
  mode: ConversationMode;
  difficulty: string;
  correctionMode: CorrectionMode;
  topic?: string;
  scenarioId?: string;
  userProfile?: {
    targetVariety?: string;
    estimatedLevel?: string;
  };
  learningGoals: readonly string[];
  recurringWeaknesses: readonly string[];
  targetVocabulary: readonly string[];
  recentTurns: readonly {
    speaker: string;
    text: string;
  }[];
}
