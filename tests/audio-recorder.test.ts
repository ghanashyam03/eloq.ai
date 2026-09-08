import { describe, it, expect } from "vitest";
import { AudioRecorder } from "@/lib/audio/audio-recorder";
import { validateAudioPayload } from "@/lib/audio/audio-validator";
import { AppError } from "@/lib/errors/app-error";

describe("AudioRecorder Abstraction & Audio Validation", () => {
  it("should initialize with idle status and zero duration", () => {
    const recorder = new AudioRecorder();
    expect(recorder.getStatus()).toBe("idle");
    expect(recorder.getDurationSeconds()).toBe(0);
    expect(recorder.getLastError()).toBeNull();
  });

  it("should validate valid audio payloads and report byte size", () => {
    const dummyBuffer = Buffer.from("DUMMY_AUDIO_PAYLOAD_BYTES");
    const result = validateAudioPayload(dummyBuffer, "audio/webm");
    expect(result.isValid).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("should throw AppError.validation when audio payload is empty", () => {
    const emptyBuffer = Buffer.alloc(0);
    expect(() => validateAudioPayload(emptyBuffer, "audio/webm")).toThrow(AppError);
  });

  it("should throw AppError.validation when audio MIME type is unsupported", () => {
    const dummyBuffer = Buffer.from("AUDIO");
    expect(() => validateAudioPayload(dummyBuffer, "video/avi")).toThrow("Unsupported audio MIME type");
  });
});
