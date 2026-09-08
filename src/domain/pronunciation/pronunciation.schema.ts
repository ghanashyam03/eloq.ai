import { z } from "zod";

export const PhonemeScoreSchema = z.object({
  phoneme: z.string(),
  score: z.number().min(0).max(100),
  isAccurate: z.boolean(),
});

export const PronunciationEvaluationSchema = z.object({
  id: z.string().uuid(),
  utteranceId: z.string().uuid(),
  targetPhonemes: z.array(PhonemeScoreSchema),
  overallScore: z.number().min(0).max(100),
  evaluatedAt: z.date(),
});
export type PronunciationEvaluation = z.infer<typeof PronunciationEvaluationSchema>;
