import { AppError } from "../errors/app-error";

export interface AudioValidationOptions {
  maxSizeBytes?: number;
  maxDurationSeconds?: number;
  allowedMimeTypes?: readonly string[];
}

const DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const DEFAULT_ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/m4a",
  "audio/x-wav",
];

/**
 * Validates audio binary payloads before passing to STT providers.
 */
export function validateAudioPayload(
  buffer: Buffer | ArrayBuffer,
  mimeType: string,
  options?: AudioValidationOptions
): { isValid: boolean; sizeBytes: number } {
  const maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const allowedMimeTypes = options?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;

  const sizeBytes = buffer instanceof Buffer ? buffer.length : buffer.byteLength;

  if (sizeBytes === 0) {
    throw AppError.validation("Audio payload is empty (0 bytes)");
  }

  if (sizeBytes > maxSizeBytes) {
    throw AppError.validation(
      `Audio payload size (${(sizeBytes / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed limit of ${(maxSizeBytes / (1024 * 1024)).toFixed(2)}MB`
    );
  }

  const normalizedMime = mimeType.split(";")[0]?.toLowerCase().trim() ?? "";
  const isAllowed = allowedMimeTypes.some((type) => normalizedMime.includes(type));

  if (!isAllowed) {
    throw AppError.validation(
      `Unsupported audio MIME type '${mimeType}'. Allowed types: ${allowedMimeTypes.join(", ")}`
    );
  }

  return { isValid: true, sizeBytes };
}
