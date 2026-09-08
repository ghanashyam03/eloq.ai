import {
  SpeechAnalysisCapabilities,
  WordTimestamp,
  PhonemeAlignment,
} from "@/domain/speech/pronunciation.schema";

export interface SpeechAnalysisInput {
  audioBuffer?: Buffer | undefined;
  mimeType?: string | undefined;
  transcript: string;
  wordTimestamps?: WordTimestamp[] | undefined;
  audioDurationMs?: number | undefined;
}

export interface SpeechAnalysisRawOutput {
  capabilities: SpeechAnalysisCapabilities;
  wordTimestamps?: WordTimestamp[] | undefined;
  phonemes?: PhonemeAlignment[] | undefined;
  pitchHzValues?: number[] | undefined;
  speakingDurationMs?: number | undefined;
}

export interface SpeechAnalysisProvider {
  readonly providerName: string;
  readonly isFree: boolean;

  getCapabilities(): SpeechAnalysisCapabilities;

  analyzeSpeechData(input: SpeechAnalysisInput): Promise<SpeechAnalysisRawOutput>;
}
