import { z } from "zod";

export const GrammarPatternSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  ruleCategory: z.string().min(1),
  patternDescription: z.string(),
  frequentErrorExamples: z.array(z.string()),
  errorCount: z.number().int().nonnegative().default(1),
  lastTriggeredAt: z.date(),
});
export type GrammarPattern = z.infer<typeof GrammarPatternSchema>;
