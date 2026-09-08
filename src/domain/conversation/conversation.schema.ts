import { z } from "zod";

export const ConversationRoleSchema = z.enum(["user", "assistant", "system"]);

export const ConversationMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: ConversationRoleSchema,
  text: z.string().min(1),
  audioUrl: z.string().url().optional(),
  createdAt: z.date(),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  topic: z.string().min(1),
  status: z.enum(["active", "completed", "archived"]).default("active"),
  startedAt: z.date(),
  endedAt: z.date().optional(),
});
export type ConversationSession = z.infer<typeof ConversationSessionSchema>;
