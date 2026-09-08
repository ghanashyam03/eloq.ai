import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MockTTSProvider } from "@/server/providers/tts/mock-tts.provider";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

const ttsRequestSchema = z.object({
  text: z.string().min(1, "Text cannot be empty for TTS synthesis"),
  voice: z.string().optional(),
  format: z.enum(["mp3", "wav", "ogg"]).default("mp3"),
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      throw AppError.validation("Request body must be valid JSON");
    }

    const validationResult = ttsRequestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      throw AppError.validation("Invalid TTS request payload", validationResult.error.issues);
    }

    const { text, voice, format } = validationResult.data;
    const provider = new MockTTSProvider();
    const result = await provider.synthesizeSpeech(text, {
      ...(voice !== undefined ? { voiceId: voice } : {}),
      format,
    });

    logger.info("Synthesized speech audio payload", {
      requestId,
      textLength: text.length,
      format,
    });

    return new NextResponse(new Uint8Array(result.audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": result.audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      logger.warn("TTS API failed with operational error", { requestId, category: error.code });
      return NextResponse.json(error.toResponse(requestId), { status: error.statusCode });
    }

    logger.error("Unhandled error in TTS API route", { requestId }, error);
    const internalError = AppError.internal("Failed to synthesize speech audio");
    return NextResponse.json(internalError.toResponse(requestId), { status: 500 });
  }
}
