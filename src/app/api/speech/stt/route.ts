import { NextRequest, NextResponse } from "next/server";
import { validateAudioPayload } from "@/lib/audio/audio-validator";
import { MockSTTProvider } from "@/server/providers/stt/mock-stt.provider";
import { HuggingFaceSTTProvider } from "@/server/providers/stt/huggingface-stt.provider";
import { STTProvider } from "@/server/providers/stt/stt-provider.interface";
import { config } from "@/lib/config/env";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

function getSTTProvider(): STTProvider {
  if (config.STT_PROVIDER === "whisper") {
    return new HuggingFaceSTTProvider();
  }
  return new MockSTTProvider();
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      throw AppError.validation("Expected multipart form data containing an audio file");
    }

    const file = formData.get("audio") as File | null;
    if (!file) {
      throw AppError.validation("Missing 'audio' file field in request payload");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "audio/webm";

    // Validate payload size and MIME type
    validateAudioPayload(buffer, mimeType);

    const provider = getSTTProvider();
    const result = await provider.transcribeBuffer(buffer, mimeType);

    logger.info("Speech-to-text API endpoint transcribed audio cleanly", {
      requestId,
      provider: result.provider,
      textLength: result.fullText.length,
    });

    // EPHEMERAL PRIVACY GUARANTEE: buffer is garbage collected after return
    return NextResponse.json({
      success: true,
      transcript: result.fullText,
      durationSeconds: result.durationSeconds,
      confidence: result.confidence,
      provider: result.provider,
    });
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn("STT API failed with operational error", { requestId, category: error.code });
      return NextResponse.json(error.toResponse(requestId), { status: error.statusCode });
    }

    logger.error("Unhandled error in STT API route", { requestId }, error);
    const internalError = AppError.internal("Failed to transcribe audio payload");
    return NextResponse.json(internalError.toResponse(requestId), { status: 500 });
  }
}
