import { TTSProvider, TTSResult, TTSOptions } from "./tts-provider.interface";
import { AppError } from "@/lib/errors/app-error";

export class MockTTSProvider implements TTSProvider {
  public readonly providerName = "mock";
  public readonly isFree = true;

  async synthesizeSpeech(text: string, options?: TTSOptions): Promise<TTSResult> {
    if (!text || text.trim().length === 0) {
      throw AppError.validation("Text payload cannot be empty for TTS synthesis");
    }

    // Return synthetic WAV audio header + dummy buffer payload for tests
    const dummyBuffer = Buffer.from(`MOCK_AUDIO_DATA_FOR: ${text}`);

    return {
      audioBuffer: dummyBuffer,
      contentType: options?.format === "wav" ? "audio/wav" : "audio/mp3",
      durationSeconds: Math.max(1, Math.round(text.length * 0.05)),
      provider: this.providerName,
    };
  }
}
