import { z } from "zod";

export const ProgressSnapshotSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.date(),
  fluencyRating: z.number().min(0).max(100),
  grammarRating: z.number().min(0).max(100),
  vocabularyRating: z.number().min(0).max(100),
  pronunciationRating: z.number().min(0).max(100),
  practiceDurationMinutes: z.number().nonnegative(),
});
export type ProgressSnapshot = z.infer<typeof ProgressSnapshotSchema>;
