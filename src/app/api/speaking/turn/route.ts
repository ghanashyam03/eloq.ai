import { NextRequest, NextResponse } from "next/server";
import { speakingPipelineOrchestrator } from "@/server/speech/speaking-pipeline-orchestrator";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let userId = "";
    let conversationId = "";
    let rawText: string | undefined;
    let audioBlob: Blob | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      userId = (formData.get("userId") as string) ?? "";
      conversationId = (formData.get("conversationId") as string) ?? "";
      rawText = (formData.get("text") as string) ?? undefined;
      const audioFile = formData.get("audio") as File | null;
      if (audioFile) {
        audioBlob = audioFile;
      }
    } else {
      const body = await req.json();
      userId = body.userId ?? "";
      conversationId = body.conversationId ?? "";
      rawText = body.text ?? undefined;
    }

    if (!userId || !conversationId) {
      return NextResponse.json(
        { error: "Missing required parameters: 'userId' and 'conversationId'" },
        { status: 400 }
      );
    }

    if (!rawText && !audioBlob) {
      return NextResponse.json(
        { error: "Must provide either audio file or text transcript" },
        { status: 400 }
      );
    }

    // Rate Limiting & Cost Guard security check
    const { rateLimiter } = await import("@/server/security/rate-limiter");
    const { costGuard } = await import("@/server/security/cost-guard");

    rateLimiter.checkRateLimit(userId);
    costGuard.validateUsage(userId, conversationId, 300);

    const result = await speakingPipelineOrchestrator.processTurn({
      userId,
      conversationId,
      rawText,
      audioBlob,
    });

    return NextResponse.json({
      success: true,
      turn: result.turn,
      ttsFailed: result.ttsFailed,
      analysisStatus: result.turn.analysisStatus,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logger.error("API speaking turn failed", {}, error);
    return NextResponse.json({ error: "Internal speaking pipeline error" }, { status: 500 });
  }
}
