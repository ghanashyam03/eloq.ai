import { z } from "zod";

export const SpeakingStateSchema = z.enum([
  "IDLE",
  "REQUESTING_MIC_PERMISSION",
  "READY",
  "RECORDING",
  "TRANSCRIBING",
  "THINKING",
  "SPEAKING",
  "INTERRUPTED",
  "PAUSED",
  "ERROR",
  "COMPLETED",
]);
export type SpeakingState = z.infer<typeof SpeakingStateSchema>;

export const AnalysisStatusSchema = z.enum(["pending", "completed", "failed"]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

export const SpeakingTurnSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  turnOrder: z.number().int().nonnegative(),
  userText: z.string(),
  assistantText: z.string(),
  audioUrl: z.string().optional(),
  sttDurationMs: z.number().nonnegative().optional(),
  llmDurationMs: z.number().nonnegative().optional(),
  ttsDurationMs: z.number().nonnegative().optional(),
  ttsFailed: z.boolean().default(false),
  analysisStatus: AnalysisStatusSchema.default("pending"),
  analysis: z.any().optional(),
  createdAt: z.date(),
});
export type SpeakingTurn = z.infer<typeof SpeakingTurnSchema>;

export const SpeakingTelemetrySchema = z.object({
  turnId: z.string(),
  sttLatencyMs: z.number().nonnegative(),
  llmLatencyMs: z.number().nonnegative(),
  ttsLatencyMs: z.number().nonnegative(),
  totalTurnLatencyMs: z.number().nonnegative(),
  isCancelled: z.boolean(),
  isSuccess: z.boolean(),
  errorMessage: z.string().optional(),
  timestamp: z.date(),
});
export type SpeakingTelemetry = z.infer<typeof SpeakingTelemetrySchema>;

export const SpeakingSessionConfigSchema = z.object({
  userId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  mode: z.string().default("free_chat"),
  difficulty: z.string().default("intermediate"),
  autoPlayTTS: z.boolean().default(true),
  enableBargeIn: z.boolean().default(true),
});
export type SpeakingSessionConfig = z.infer<typeof SpeakingSessionConfigSchema>;
