import {
  SpeechAnalysisProvider,
  SpeechAnalysisInput,
  SpeechAnalysisRawOutput,
} from "./speech-analysis-provider.interface";
import { SpeechAnalysisCapabilities, WordTimestamp, PhonemeAlignment } from "@/domain/speech/pronunciation.schema";

export interface MockSpeechAnalysisConfig {
  capabilities?: Partial<SpeechAnalysisCapabilities> | undefined;
  cannedTimestamps?: WordTimestamp[] | undefined;
  cannedPhonemes?: PhonemeAlignment[] | undefined;
  cannedPitchValues?: number[] | undefined;
  cannedSpeakingDurationMs?: number | undefined;
}

export class MockSpeechAnalysisProvider implements SpeechAnalysisProvider {
  public readonly providerName = "mock_speech_analyzer";
  public readonly isFree = true;

  constructor(private config: MockSpeechAnalysisConfig = {}) {}

  public setMockConfig(config: MockSpeechAnalysisConfig): void {
    this.config = { ...this.config, ...config };
  }

  public getCapabilities(): SpeechAnalysisCapabilities {
    return {
      supportsPhonemeAlignment: this.config.capabilities?.supportsPhonemeAlignment ?? false,
      supportsWordTimestamps: this.config.capabilities?.supportsWordTimestamps ?? true,
      supportsPitch: this.config.capabilities?.supportsPitch ?? false,
      supportsEnergy: this.config.capabilities?.supportsEnergy ?? false,
      supportsSpeechRate: this.config.capabilities?.supportsSpeechRate ?? true,
      providerName: this.providerName,
    };
  }

  async analyzeSpeechData(input: SpeechAnalysisInput): Promise<SpeechAnalysisRawOutput> {
    const caps = this.getCapabilities();

    let wordTimestamps: WordTimestamp[] | undefined = input.wordTimestamps ?? this.config.cannedTimestamps;

    if (!wordTimestamps && caps.supportsWordTimestamps && input.transcript) {
      const words = input.transcript.trim().split(/\s+/).filter(Boolean);
      let currentTime = 100;
      wordTimestamps = words.map((w) => {
        const duration = Math.max(200, w.length * 60);
        const item: WordTimestamp = {
          word: w,
          startTimeMs: currentTime,
          endTimeMs: currentTime + duration,
          confidence: 0.95,
        };
        currentTime += duration + 100;
        return item;
      });
    }

    let calculatedDurationMs: number | undefined;
    if (wordTimestamps && wordTimestamps.length > 0) {
      const first = wordTimestamps[0];
      const last = wordTimestamps[wordTimestamps.length - 1];
      if (first && last) {
        calculatedDurationMs = last.endTimeMs - first.startTimeMs;
      }
    }

    const speakingDurationMs =
      this.config.cannedSpeakingDurationMs ?? calculatedDurationMs ?? input.audioDurationMs;

    return {
      capabilities: caps,
      wordTimestamps: caps.supportsWordTimestamps ? wordTimestamps : undefined,
      phonemes: caps.supportsPhonemeAlignment ? this.config.cannedPhonemes : undefined,
      pitchHzValues: caps.supportsPitch ? this.config.cannedPitchValues : undefined,
      speakingDurationMs,
    };
  }
}
