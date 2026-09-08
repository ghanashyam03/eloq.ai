import { STTProvider, STTTranscriptionResult, STTOptions } from "./stt-provider.interface";
import { AppError } from "@/lib/errors/app-error";

export interface MockSTTConfig {
  cannedTranscript?: string;
  shouldFail?: boolean;
  failureError?: AppError;
  latencyMs?: number;
}

export class MockSTTProvider implements STTProvider {
  public readonly providerName = "mock";
  public readonly isFree = true;

  constructor(private config: MockSTTConfig = {}) {}

  public setMockConfig(config: MockSTTConfig): void {
    this.config = { ...this.config, ...config };
  }

  async transcribeBuffer(
    audioBuffer: Buffer,
    mimeType: string,
    options?: STTOptions
  ): Promise<STTTranscriptionResult> {
    if (this.config.latencyMs) {
      await new Promise((res) => setTimeout(res, this.config.latencyMs));
    }

    if (this.config.shouldFail) {
      throw this.config.failureError ?? AppError.externalProvider("mock", "Simulated STT transcription failure");
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw AppError.validation("Cannot transcribe empty audio buffer");
    }

    let transcript: string;
    if (this.config.cannedTranscript) {
      transcript = this.config.cannedTranscript;
    } else if (process.env.NODE_ENV === "test") {
      const defaultTranscripts = [
        "I am practicing my English speaking skills with the AI tutor today.",
        "I want to improve my grammar and vocabulary for professional conversations.",
      ];
      transcript = defaultTranscripts[Math.floor(Date.now() % defaultTranscripts.length)] ?? defaultTranscripts[0]!;
    } else {
      throw AppError.validation(
        "No speech audio was transcribed. Please ensure your microphone is active and speak clearly, or type your message below."
      );
    }
    const words = transcript.split(" ").map((w, idx) => ({
      word: w,
      startTimeSeconds: idx * 0.4,
      endTimeSeconds: (idx + 1) * 0.4,
      confidence: 0.95,
    }));

    return {
      fullText: transcript,
      language: options?.language ?? "en",
      durationSeconds: words.length * 0.4,
      segments: [
        {
          startTimeSeconds: 0,
          endTimeSeconds: words.length * 0.4,
          text: transcript,
          confidence: 0.95,
        },
      ],
      words,
      rawResponse: { mock: true, mimeType, sizeBytes: audioBuffer.length },
      provider: this.providerName,
    };
  }
}
