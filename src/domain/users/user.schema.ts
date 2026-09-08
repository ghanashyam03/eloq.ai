import { z } from "zod";

export const CEFRProficiencyLevelSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export type CEFRProficiencyLevel = z.infer<typeof CEFRProficiencyLevelSchema>;

export const UserSettingsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  targetProficiency: CEFRProficiencyLevelSchema.default("B2"),
  preferredVoice: z.string().default("en-US-Standard-C"),
  dailyGoalMinutes: z.number().int().min(1).max(300).default(15),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;
