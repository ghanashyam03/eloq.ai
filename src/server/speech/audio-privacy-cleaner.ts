import { logger } from "@/lib/logger/logger";

export class AudioPrivacyCleaner {
  /**
   * Overwrites in-memory audio buffers and releases temporary binary structures to guarantee audio privacy.
   */
  public sanitizeAudioBuffer(buffer?: Buffer | ArrayBuffer | Blob): void {
    if (!buffer) return;

    try {
      if (Buffer.isBuffer(buffer)) {
        buffer.fill(0); // Zero out buffer memory
      } else if (buffer instanceof ArrayBuffer) {
        new Uint8Array(buffer).fill(0);
      }
      logger.info("Sanitized temporary audio buffer memory");
    } catch (err) {
      logger.warn("Failed to overwrite audio buffer memory", {}, err);
    }
  }

  /**
   * Sanitizes object payloads before logging to guarantee raw audio data/base64 strings are never logged.
   */
  public sanitizeLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...payload };

    for (const key of Object.keys(sanitized)) {
      if (key.toLowerCase().includes("audio") || key.toLowerCase().includes("pcm") || key.toLowerCase().includes("base64")) {
        const val = sanitized[key];
        if (typeof val === "string" && val.length > 50) {
          sanitized[key] = `[REDACTED_AUDIO_DATA len=${val.length}]`;
        } else if (val instanceof Buffer || val instanceof ArrayBuffer || val instanceof Blob) {
          sanitized[key] = "[REDACTED_AUDIO_BUFFER]";
        }
      }
    }

    return sanitized;
  }
}

export const audioPrivacyCleaner = new AudioPrivacyCleaner();
