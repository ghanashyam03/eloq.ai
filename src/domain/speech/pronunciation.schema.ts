import { z } from "zod";

/**
 * Explicit provider capability model.
 * Prevents calculating or claiming metrics that lack underlying provider evidence.
 */
export const SpeechAnalysisCapabilitiesSchema = z.object({
  supportsPhonemeAlignment: z.boolean().default(false),
  supportsWordTimestamps: z.boolean().default(false),
  supportsPitch: z.boolean().default(false),
  supportsEnergy: z.boolean().default(false),
  supportsSpeechRate: z.boolean().default(false),
  providerName: z.string().default("unknown"),
});
export type SpeechAnalysisCapabilities = z.infer<typeof SpeechAnalysisCapabilitiesSchema>;

/**
 * Word timestamp object passed by STT or speech analysis providers.
 */
export const WordTimestampSchema = z.object({
  word: z.string(),
  startTimeMs: z.number().nonnegative(),
  endTimeMs: z.number().nonnegative(),
  confidence: z.number().min(0.0).max(1.0).optional(),
});
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;

/**
 * Phoneme alignment payload if supplied by an audio-capable speech provider.
 */
export const PhonemeAlignmentSchema = z.object({
  targetPhoneme: z.string(),
  spokenPhoneme: z.string(),
  startTimeMs: z.number().nonnegative(),
  endTimeMs: z.number().nonnegative(),
  confidence: z.number().min(0.0).max(1.0),
  errorType: z.enum(["correct", "substitution", "omission", "insertion", "distortion"]).default("correct"),
});
export type PhonemeAlignment = z.infer<typeof PhonemeAlignmentSchema>;

/**
 * Pause metrics calculated deterministically from word timestamp gaps.
 */
export const PauseMetricsSchema = z.object({
  status: z.enum(["AVAILABLE", "NOT_AVAILABLE"]).default("NOT_AVAILABLE"),
  pauseCount: z.number().int().nonnegative().optional(),
  totalPauseDurationMs: z.number().nonnegative().optional(),
  averagePauseDurationMs: z.number().nonnegative().optional(),
  longestPauseDurationMs: z.number().nonnegative().optional(),
  gapsMs: z.array(z.number().nonnegative()).optional(),
});
export type PauseMetrics = z.infer<typeof PauseMetricsSchema>;

/**
 * Filler categories separating hesitation sounds from valid discourse markers.
 */
export const FillerItemSchema = z.object({
  text: z.string(),
  type: z.enum(["hesitation_filler", "discourse_marker"]),
  startTimeMs: z.number().nonnegative().optional(),
  endTimeMs: z.number().nonnegative().optional(),
  isProblematic: z.boolean().default(false),
  contextExplanation: z.string().optional(),
});
export type FillerItem = z.infer<typeof FillerItemSchema>;

export const FillerMetricsSchema = z.object({
  hesitationCount: z.number().int().nonnegative().default(0),
  discourseMarkerCount: z.number().int().nonnegative().default(0),
  items: z.array(FillerItemSchema).default([]),
});
export type FillerMetrics = z.infer<typeof FillerMetricsSchema>;

/**
 * Conversational repetitions and self-repairs.
 */
export const RepetitionItemSchema = z.object({
  repeatedText: z.string(),
  type: z.enum(["repeated_word", "repeated_phrase", "self_repair", "abandoned_sentence"]),
  isExcessive: z.boolean().default(false),
  explanation: z.string(),
});
export type RepetitionItem = z.infer<typeof RepetitionItemSchema>;

export const RepetitionMetricsSchema = z.object({
  totalRepetitions: z.number().int().nonnegative().default(0),
  excessiveCount: z.number().int().nonnegative().default(0),
  items: z.array(RepetitionItemSchema).default([]),
});
export type RepetitionMetrics = z.infer<typeof RepetitionMetricsSchema>;

/**
 * Pitch and Intonation metrics (only present if audio evidence supports it).
 */
export const PitchMetricsSchema = z.object({
  status: z.enum(["AVAILABLE", "NOT_AVAILABLE"]).default("NOT_AVAILABLE"),
  meanPitchHz: z.number().positive().optional(),
  minPitchHz: z.number().positive().optional(),
  maxPitchHz: z.number().positive().optional(),
  pitchVariationStdDev: z.number().nonnegative().optional(),
  note: z.string().optional(),
});
export type PitchMetrics = z.infer<typeof PitchMetricsSchema>;

/**
 * Raw Fluency Profile storing exact measurements first without premature score collapsing.
 */
export const RawFluencyProfileSchema = z.object({
  wordsPerMinute: z.number().nonnegative().nullable(),
  speechRateStatus: z.enum(["AVAILABLE", "NOT_AVAILABLE"]).default("NOT_AVAILABLE"),
  speakingDurationMs: z.number().nonnegative().nullable(),
  totalDurationMs: z.number().nonnegative().nullable(),
  pauses: PauseMetricsSchema,
  fillers: FillerMetricsSchema,
  repetitions: RepetitionMetricsSchema,
  pitch: PitchMetricsSchema,
  analyzedAt: z.date(),
});
export type RawFluencyProfile = z.infer<typeof RawFluencyProfileSchema>;

/**
 * Phoneme Accuracy result (audio-based, returns NOT_AVAILABLE when alignment is absent).
 */
export const PhonemeAnalysisResultSchema = z.object({
  status: z.enum(["AVAILABLE", "NOT_AVAILABLE"]).default("NOT_AVAILABLE"),
  phonemeAccuracyScore: z.number().min(0.0).max(1.0).nullable(),
  totalPhonemesEvaluated: z.number().int().nonnegative().default(0),
  alignments: z.array(PhonemeAlignmentSchema).default([]),
  problemPhonemes: z.array(z.string()).default([]),
  confidence: z.number().min(0.0).max(1.0).default(0.0),
  note: z.string().optional(),
});
export type PhonemeAnalysisResult = z.infer<typeof PhonemeAnalysisResultSchema>;

/**
 * Target Pronunciation Training Skill Entity.
 */
export const PronunciationSkillSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  skillType: z.enum(["phoneme", "word_stress", "phrase_stress", "intonation_pattern"]),
  targetPattern: z.string(), // e.g., "/θ/", "TH-sound", "word-initial stress"
  masteryScore: z.number().min(0.0).max(1.0).default(0.0),
  evidenceCount: z.number().int().nonnegative().default(0),
  lastPracticedAt: z.date(),
  examples: z.array(z.string()).default([]),
});
export type PronunciationSkill = z.infer<typeof PronunciationSkillSchema>;

/**
 * Complete Speech Quality Analysis Output.
 */
export const SpeechQualityAnalysisSchema = z.object({
  analysisId: z.string().uuid(),
  capabilities: SpeechAnalysisCapabilitiesSchema,
  isAudioBased: z.boolean(),
  fluencyProfile: RawFluencyProfileSchema,
  phonemeAnalysis: PhonemeAnalysisResultSchema,
  targetedSkills: z.array(PronunciationSkillSchema).default([]),
  analysisTimestamp: z.date(),
});
export type SpeechQualityAnalysis = z.infer<typeof SpeechQualityAnalysisSchema>;
