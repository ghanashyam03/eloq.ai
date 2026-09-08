import { HfInference } from "@huggingface/inference";
import { STTProvider, STTTranscriptionResult, STTOptions } from "./stt-provider.interface";
import { AppError } from "@/lib/errors/app-error";
import { config } from "@/lib/config/env";
import { logger } from "@/lib/logger/logger";

export class HuggingFaceSTTProvider implements STTProvider {
  public readonly providerName = "huggingface-whisper";
  public readonly isFree = true;
  private client: HfInference;

  constructor(token?: string) {
    const apiToken = token ?? config.HF_TOKEN;
    this.client = new HfInference(apiToken);
  }

  async transcribeBuffer(
    audioBuffer: Buffer,
    mimeType: string,
    options?: STTOptions
  ): Promise<STTTranscriptionResult> {
    const startTime = Date.now();
    const model = "openai/whisper-large-v3-turbo";
    const timeoutMs = 30000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (!audioBuffer || audioBuffer.length === 0) {
        throw AppError.validation("Audio buffer cannot be empty");
      }

      // Prepare audio Blob payload for Hugging Face Inference API
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });

      const result = await this.client.automaticSpeechRecognition(
        {
          model,
          data: blob,
        },
        {
          fetch: (url, init) =>
            fetch(url, {
              ...init,
              signal: controller.signal,
            }),
        }
      );

      const fullText = result.text.trim();
      const latencyMs = Date.now() - startTime;

      logger.info("Hugging Face Whisper STT transcription completed", {
        provider: this.providerName,
        model,
        latencyMs,
        textLength: fullText.length,
      });

      return {
        fullText,
        language: options?.language ?? "en",
        rawResponse: result,
        provider: this.providerName,
        segments: [
          {
            startTimeSeconds: 0,
            endTimeSeconds: latencyMs / 1000,
            text: fullText,
          },
        ],
      };
    } catch (error) {
      if (controller.signal.aborted) {
        throw AppError.timeout(`STT transcription timed out after ${timeoutMs}ms`);
      }

      if (error instanceof AppError) throw error;

      logger.error("Hugging Face STT request failed", { provider: this.providerName }, error);
      throw AppError.externalProvider(
        this.providerName,
        `Transcription failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
