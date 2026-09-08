import { z } from "zod";

export const CurriculumExerciseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  targetCategory: z.enum(["grammar", "vocabulary", "pronunciation", "fluency"]),
  instructions: z.string(),
  promptText: z.string(),
  expectedTargetStructure: z.string().optional(),
});

export const CurriculumUnitSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  focusWeaknessId: z.string().uuid().optional(),
  exercises: z.array(CurriculumExerciseSchema),
  isCompleted: z.boolean().default(false),
  generatedAt: z.date(),
});
export type CurriculumUnit = z.infer<typeof CurriculumUnitSchema>;
