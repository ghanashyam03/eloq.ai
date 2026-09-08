import { SpeakingTelemetry, SpeakingTelemetrySchema } from "@/domain/speech/speaking-session.schema";
import { logger } from "@/lib/logger/logger";

export interface TelemetrySummary {
  totalTurnsRecorded: number;
  averageSTTLatencyMs: number;
  averageLLMLatencyMs: number;
  averageTTSLatencyMs: number;
  averageTotalTurnLatencyMs: number;
  successRatePercentage: number;
  cancellationRatePercentage: number;
}

export class SpeakingTelemetryTracker {
  private telemetryLogs: SpeakingTelemetry[] = [];

  /**
   * Records technical timing and outcome metrics for a completed or cancelled turn.
   */
  recordTurnTelemetry(data: {
    turnId: string;
    sttLatencyMs: number;
    llmLatencyMs: number;
    ttsLatencyMs: number;
    totalTurnLatencyMs: number;
    isCancelled: boolean;
    isSuccess: boolean;
    errorMessage?: string;
  }): SpeakingTelemetry {
    const telemetry = SpeakingTelemetrySchema.parse({
      turnId: data.turnId,
      sttLatencyMs: Math.max(0, data.sttLatencyMs),
      llmLatencyMs: Math.max(0, data.llmLatencyMs),
      ttsLatencyMs: Math.max(0, data.ttsLatencyMs),
      totalTurnLatencyMs: Math.max(0, data.totalTurnLatencyMs),
      isCancelled: data.isCancelled,
      isSuccess: data.isSuccess,
      errorMessage: data.errorMessage,
      timestamp: new Date(),
    });

    this.telemetryLogs.push(telemetry);

    logger.info("Recorded speaking turn telemetry metrics", {
      turnId: data.turnId,
      sttLatencyMs: telemetry.sttLatencyMs,
      llmLatencyMs: telemetry.llmLatencyMs,
      ttsLatencyMs: telemetry.ttsLatencyMs,
      totalTurnLatencyMs: telemetry.totalTurnLatencyMs,
      isSuccess: telemetry.isSuccess,
      isCancelled: telemetry.isCancelled,
    });

    return telemetry;
  }

  /**
   * Calculates aggregate technical metrics across all recorded telemetry turns.
   */
  getSummary(): TelemetrySummary {
    const total = this.telemetryLogs.length;
    if (total === 0) {
      return {
        totalTurnsRecorded: 0,
        averageSTTLatencyMs: 0,
        averageLLMLatencyMs: 0,
        averageTTSLatencyMs: 0,
        averageTotalTurnLatencyMs: 0,
        successRatePercentage: 100,
        cancellationRatePercentage: 0,
      };
    }

    const sumSTT = this.telemetryLogs.reduce((acc, t) => acc + t.sttLatencyMs, 0);
    const sumLLM = this.telemetryLogs.reduce((acc, t) => acc + t.llmLatencyMs, 0);
    const sumTTS = this.telemetryLogs.reduce((acc, t) => acc + t.ttsLatencyMs, 0);
    const sumTotal = this.telemetryLogs.reduce((acc, t) => acc + t.totalTurnLatencyMs, 0);

    const successCount = this.telemetryLogs.filter((t) => t.isSuccess).length;
    const cancelCount = this.telemetryLogs.filter((t) => t.isCancelled).length;

    return {
      totalTurnsRecorded: total,
      averageSTTLatencyMs: parseFloat((sumSTT / total).toFixed(1)),
      averageLLMLatencyMs: parseFloat((sumLLM / total).toFixed(1)),
      averageTTSLatencyMs: parseFloat((sumTTS / total).toFixed(1)),
      averageTotalTurnLatencyMs: parseFloat((sumTotal / total).toFixed(1)),
      successRatePercentage: parseFloat(((successCount / total) * 100).toFixed(1)),
      cancellationRatePercentage: parseFloat(((cancelCount / total) * 100).toFixed(1)),
    };
  }

  public clear(): void {
    this.telemetryLogs = [];
  }
}

export const speakingTelemetryTracker = new SpeakingTelemetryTracker();
