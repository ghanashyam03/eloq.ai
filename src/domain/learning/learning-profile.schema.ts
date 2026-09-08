import { z } from "zod";

export const RecurringWeaknessSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(["grammar", "vocabulary", "pronunciation", "fluency"]),
  topic: z.string(),
  occurrenceFrequency: z.number().int().positive(),
  firstDetectedAt: z.date(),
  lastDetectedAt: z.date(),
  resolved: z.boolean().default(false),
});

export const UserLearningProfileSchema = z.object({
  userId: z.string().uuid(),
  topWeaknesses: z.array(RecurringWeaknessSchema),
  totalPracticeTimeMinutes: z.number().nonnegative().default(0),
  totalSessionsCompleted: z.number().int().nonnegative().default(0),
  updatedAt: z.date(),
});
export type UserLearningProfile = z.infer<typeof UserLearningProfileSchema>;
