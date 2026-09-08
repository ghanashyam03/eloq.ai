export interface AudioWordSegment {
  word: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  confidence?: number;
}

export interface AudioTranscriptionSegment {
  startTimeSeconds: number;
  endTimeSeconds: number;
  text: string;
  confidence?: number;
}

export interface STTTranscriptionResult {
  fullText: string;
  language?: string;
  confidence?: number;
  durationSeconds?: number;
  segments: readonly AudioTranscriptionSegment[];
  words?: readonly AudioWordSegment[];
  rawResponse: unknown;
  provider: string;
}

export interface STTOptions {
  language?: string;
  promptHint?: string;
}

/**
 * Interface contract for decoupled Speech-To-Text services.
 */
export interface STTProvider {
  readonly providerName: string;

  transcribeBuffer(
    audioBuffer: Buffer,
    mimeType: string,
    options?: STTOptions
  ): Promise<STTTranscriptionResult>;
}
