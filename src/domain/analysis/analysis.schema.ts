import { z } from "zod";

export const ErrorSeveritySchema = z.enum(["low", "medium", "high"]);
export const ErrorCategorySchema = z.enum([
  "grammar",
  "vocabulary",
  "pronunciation",
  "fluency",
  "pragmatics",
]);

export const LinguisticErrorSchema = z.object({
  id: z.string().uuid(),
  category: ErrorCategorySchema,
  originalPhrase: z.string(),
  correctedPhrase: z.string(),
  explanation: z.string(),
  severity: ErrorSeveritySchema,
  startIndex: z.number().int().nonnegative().optional(),
  endIndex: z.number().int().positive().optional(),
});
export type LinguisticError = z.infer<typeof LinguisticErrorSchema>;

export const LinguisticAnalysisResultSchema = z.object({
  utteranceId: z.string().uuid(),
  overallFluencyScore: z.number().min(0).max(100),
  grammarScore: z.number().min(0).max(100),
  vocabularyVarietyScore: z.number().min(0).max(100),
  errors: z.array(LinguisticErrorSchema),
  analyzedAt: z.date(),
});
export type LinguisticAnalysisResult = z.infer<typeof LinguisticAnalysisResultSchema>;
