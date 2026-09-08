import { NextResponse } from "next/server";
import { config } from "@/lib/config/env";
import { logger } from "@/lib/logger/logger";

export async function GET() {
  logger.info("Health check requested", { operation: "healthCheck" });

  return NextResponse.json({
    status: "ok",
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
    providers: {
      primaryLlm: config.PRIMARY_LLM_PROVIDER,
      fallbackLlm: config.FALLBACK_LLM_PROVIDER,
      stt: config.STT_PROVIDER,
      tts: config.TTS_PROVIDER,
      embedding: config.EMBEDDING_PROVIDER,
    },
  });
}
