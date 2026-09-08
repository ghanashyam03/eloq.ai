export type RecordingStatus = "idle" | "recording" | "paused" | "stopped" | "cancelled" | "error";

export type RecorderErrorCode =
  | "permission_denied"
  | "microphone_unavailable"
  | "browser_unsupported"
  | "recording_failed";

export interface AudioRecorderError {
  code: RecorderErrorCode;
  message: string;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

/**
 * Framework-agnostic AudioRecorder abstraction managing microphone audio capture,
 * state machine transitions, error handling, and cancellation.
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private durationMs: number = 0;
  private status: RecordingStatus = "idle";
  private lastError: AudioRecorderError | null = null;

  public getStatus(): RecordingStatus {
    return this.status;
  }

  public getLastError(): AudioRecorderError | null {
    return this.lastError;
  }

  public getDurationSeconds(): number {
    if (this.status === "recording") {
      return (Date.now() - this.startTime) / 1000;
    }
    return this.durationMs / 1000;
  }

  /**
   * Requests microphone access and begins audio recording.
   */
  public async start(): Promise<void> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.setError("browser_unsupported", "Browser does not support microphone audio recording");
      throw new Error(this.lastError!.message);
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.getSupportedMimeType();

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
      this.audioChunks = [];
      this.startTime = Date.now();
      this.durationMs = 0;
      this.status = "recording";
      this.lastError = null;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = () => {
        this.setError("recording_failed", "An error occurred during audio recording");
      };

      this.mediaRecorder.start(100);
    } catch (err) {
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        this.setError("permission_denied", "Microphone access permission was denied by the user");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        this.setError("microphone_unavailable", "No active microphone device was found on this system");
      } else {
        this.setError("recording_failed", `Failed to initialize recording: ${error.message}`);
      }
      throw new Error(this.lastError!.message);
    }
  }

  /**
   * Stops recording and resolves with the captured audio Blob result.
   */
  public async stop(): Promise<RecordingResult> {
    if (this.status !== "recording" || !this.mediaRecorder) {
      throw new Error("Cannot stop recording: recorder is not active");
    }

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = () => {
        this.durationMs = Date.now() - this.startTime;
        this.status = "stopped";

        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const durationSeconds = this.durationMs / 1000;

        this.cleanupStream();
        resolve({ blob, mimeType, durationSeconds });
      };

      try {
        this.mediaRecorder!.stop();
      } catch (err) {
        this.setError("recording_failed", "Failed to stop media recorder");
        this.cleanupStream();
        reject(err);
      }
    });
  }

  /**
   * Cancels current recording immediately without returning an audio payload.
   */
  public cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore stop errors on cancellation
      }
    }
    this.audioChunks = [];
    this.durationMs = 0;
    this.status = "cancelled";
    this.cleanupStream();
  }

  private cleanupStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
  }

  private setError(code: RecorderErrorCode, message: string): void {
    this.status = "error";
    this.lastError = { code, message };
  }

  private getSupportedMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "audio/webm";
  }
}
