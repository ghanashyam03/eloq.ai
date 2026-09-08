export interface TTSOptions {
  voiceId?: string;
  speed?: number;
  pitch?: number;
  format?: "mp3" | "wav" | "ogg";
}

export interface TTSResult {
  audioBuffer: Buffer;
  contentType: string;
  durationSeconds?: number;
  provider: string;
}

/**
 * Interface contract for decoupled Text-To-Speech services.
 */
export interface TTSProvider {
  readonly providerName: string;

  synthesizeSpeech(
    text: string,
    options?: TTSOptions
  ): Promise<TTSResult>;
}
