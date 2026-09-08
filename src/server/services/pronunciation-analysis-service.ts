import {
  SpeechQualityAnalysis,
  SpeechQualityAnalysisSchema,
  WordTimestamp,
  PronunciationSkill,
} from "@/domain/speech/pronunciation.schema";
import { SpeechAnalysisProvider } from "../providers/speech-analysis/speech-analysis-provider.interface";
import { MockSpeechAnalysisProvider } from "../providers/speech-analysis/mock-speech-analysis-provider";
import { fluencyAnalyzer, FluencyAnalyzer } from "../analysis/fluency-analyzer";
import { phonemeAnalyzer, PhonemeAnalyzer } from "../analysis/phoneme-analyzer";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface PronunciationAnalysisParams {
  userId: string;
  transcript: string;
  audioBuffer?: Buffer | undefined;
  mimeType?: string | undefined;
  wordTimestamps?: WordTimestamp[] | undefined;
  audioDurationMs?: number | undefined;
  provider?: SpeechAnalysisProvider | undefined;
}

export class PronunciationAnalysisService {
  constructor(
    private readonly defaultProvider: SpeechAnalysisProvider = new MockSpeechAnalysisProvider(),
    private readonly fluencyEngine: FluencyAnalyzer = fluencyAnalyzer,
    private readonly phonemeEngine: PhonemeAnalyzer = phonemeAnalyzer
  ) {}

  /**
   * Performs evidence-based pronunciation and speech quality analysis.
   * Explicitly distinguishes text-based analysis from audio-based analysis,
   * returning NOT_AVAILABLE for missing capabilities rather than fabricating scores.
   */
  async analyzePronunciation(params: PronunciationAnalysisParams): Promise<SpeechQualityAnalysis> {
    const { userId, transcript } = params;

    if (!transcript || transcript.trim().length === 0) {
      throw AppError.validation("Transcript cannot be empty for pronunciation analysis");
    }

    const provider = params.provider ?? this.defaultProvider;

    // 1. Gather raw provider output (timestamps, phonemes, pitch data)
    const rawOutput = await provider.analyzeSpeechData({
      audioBuffer: params.audioBuffer,
      mimeType: params.mimeType,
      transcript: params.transcript,
      wordTimestamps: params.wordTimestamps,
      audioDurationMs: params.audioDurationMs,
    });

    const isAudioBased = Boolean(
      params.audioBuffer ||
        (rawOutput.wordTimestamps && rawOutput.wordTimestamps.length > 0) ||
        (rawOutput.phonemes && rawOutput.phonemes.length > 0)
    );

    // 2. Build Raw Fluency Profile (WPM, pause gaps, filler separation, repetitions, pitch)
    const fluencyProfile = this.fluencyEngine.buildFluencyProfile({
      transcript,
      timestamps: rawOutput.wordTimestamps,
      explicitSpeakingDurationMs: rawOutput.speakingDurationMs,
      totalDurationMs: params.audioDurationMs,
      pitchHzValues: rawOutput.pitchHzValues,
    });

    // 3. Perform Phoneme Analysis (returns NOT_AVAILABLE when alignment is absent)
    const phonemeAnalysis = this.phonemeEngine.analyzePhonemes(
      rawOutput.capabilities,
      rawOutput.phonemes
    );

    // 4. Derive Targeted Skills from Evidence
    const targetedSkills: PronunciationSkill[] = [];
    if (phonemeAnalysis.status === "AVAILABLE" && phonemeAnalysis.problemPhonemes.length > 0) {
      phonemeAnalysis.problemPhonemes.forEach((phoneme) => {
        targetedSkills.push({
          id: crypto.randomUUID(),
          userId,
          skillType: "phoneme",
          targetPattern: phoneme,
          masteryScore: 0.4,
          evidenceCount: 1,
          lastPracticedAt: new Date(),
          examples: [transcript],
        });
      });
    }

    // 5. Assemble and Validate Speech Quality Analysis
    const analysisId = crypto.randomUUID();
    const resultPayload: SpeechQualityAnalysis = {
      analysisId,
      capabilities: rawOutput.capabilities,
      isAudioBased,
      fluencyProfile,
      phonemeAnalysis,
      targetedSkills,
      analysisTimestamp: new Date(),
    };

    const validatedResult = SpeechQualityAnalysisSchema.parse(resultPayload);

    logger.info("Executed pronunciation and speech-quality analysis", {
      analysisId,
      userId,
      isAudioBased,
      provider: provider.providerName,
      phonemeStatus: phonemeAnalysis.status,
      speechRateStatus: fluencyProfile.speechRateStatus,
    });

    return validatedResult;
  }
}

export const pronunciationAnalysisService = new PronunciationAnalysisService();
