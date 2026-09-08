import { z } from "zod";

export const AudioSegmentSchema = z.object({
  startTimeSeconds: z.number().nonnegative(),
  endTimeSeconds: z.number().positive(),
  transcriptSnippet: z.string(),
  confidenceScore: z.number().min(0).max(1).optional(),
});
export type AudioSegment = z.infer<typeof AudioSegmentSchema>;

export const SpeechUtteranceSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  speaker: z.enum(["user", "ai"]),
  rawTranscript: z.string(),
  audioDurationSeconds: z.number().positive(),
  segments: z.array(AudioSegmentSchema).default([]),
  recordedAt: z.date(),
});
export type SpeechUtterance = z.infer<typeof SpeechUtteranceSchema>;
