import { describe, it, expect } from "vitest";
import { MockTTSProvider } from "@/server/providers/tts/mock-tts.provider";
import { TTSPlayer } from "@/lib/audio/tts-player";
import { AppError } from "@/lib/errors/app-error";

describe("Text-To-Speech (TTS) Provider & Player", () => {
  it("should synthesize speech audio buffer for non-empty text", async () => {
    const provider = new MockTTSProvider();
    const result = await provider.synthesizeSpeech("Hello, how are you today?", { format: "mp3" });

    expect(result.audioBuffer).toBeDefined();
    expect(result.audioBuffer.length).toBeGreaterThan(0);
    expect(result.contentType).toBe("audio/mp3");
    expect(result.durationSeconds).toBeGreaterThan(0);
  });

  it("should throw AppError.validation when trying to synthesize empty text", async () => {
    const provider = new MockTTSProvider();
    await expect(provider.synthesizeSpeech("   ")).rejects.toThrow(AppError);
  });

  it("should initialize client TTSPlayer and support cancelPlayback interruption", () => {
    const player = new TTSPlayer();
    expect(player.isPlaying()).toBe(false);
    expect(() => player.cancelPlayback()).not.toThrow();
  });
});
