import { describe, it, expect } from "vitest";
import { MockSTTProvider } from "@/server/providers/stt/mock-stt.provider";
import { AppError } from "@/lib/errors/app-error";

describe("Speech-To-Text (STT) Provider", () => {
  it("should transcribe valid audio buffer and return normalized transcript structure", async () => {
    const provider = new MockSTTProvider({ cannedTranscript: "Hello world speech" });
    const buffer = Buffer.from("DUMMY_AUDIO_DATA");

    const result = await provider.transcribeBuffer(buffer, "audio/webm");

    expect(result.fullText).toBe("Hello world speech");
    expect(result.provider).toBe("mock");
    expect(result.segments).toHaveLength(1);
    expect(result.words?.length).toBeGreaterThan(0);
  });

  it("should throw AppError.validation when trying to transcribe empty audio buffer", async () => {
    const provider = new MockSTTProvider();
    const emptyBuffer = Buffer.alloc(0);

    await expect(provider.transcribeBuffer(emptyBuffer, "audio/webm")).rejects.toThrow(AppError);
  });

  it("should throw AppError externalProvider when provider fails", async () => {
    const provider = new MockSTTProvider({
      shouldFail: true,
      failureError: AppError.externalProvider("mock", "STT service outage"),
    });

    await expect(
      provider.transcribeBuffer(Buffer.from("AUDIO"), "audio/webm")
    ).rejects.toThrow("STT service outage");
  });
});
