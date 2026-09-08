import { describe, it, expect, beforeEach } from "vitest";
import { SpeakingTelemetryTracker } from "@/server/speech/speaking-telemetry";

describe("Speaking Telemetry Tracker", () => {
  let tracker: SpeakingTelemetryTracker;

  beforeEach(() => {
    tracker = new SpeakingTelemetryTracker();
  });

  it("should record turn telemetry metrics accurately", () => {
    const item = tracker.recordTurnTelemetry({
      turnId: "t-1",
      sttLatencyMs: 150,
      llmLatencyMs: 400,
      ttsLatencyMs: 250,
      totalTurnLatencyMs: 800,
      isCancelled: false,
      isSuccess: true,
    });

    expect(item.turnId).toBe("t-1");
    expect(item.sttLatencyMs).toBe(150);
    expect(item.llmLatencyMs).toBe(400);
    expect(item.ttsLatencyMs).toBe(250);
    expect(item.totalTurnLatencyMs).toBe(800);
    expect(item.isSuccess).toBe(true);
  });

  it("should calculate summary latency averages and success/cancellation rates", () => {
    tracker.recordTurnTelemetry({
      turnId: "t-1",
      sttLatencyMs: 100,
      llmLatencyMs: 300,
      ttsLatencyMs: 200,
      totalTurnLatencyMs: 600,
      isCancelled: false,
      isSuccess: true,
    });

    tracker.recordTurnTelemetry({
      turnId: "t-2",
      sttLatencyMs: 200,
      llmLatencyMs: 500,
      ttsLatencyMs: 300,
      totalTurnLatencyMs: 1000,
      isCancelled: true,
      isSuccess: false,
    });

    const summary = tracker.getSummary();

    expect(summary.totalTurnsRecorded).toBe(2);
    expect(summary.averageSTTLatencyMs).toBe(150.0);
    expect(summary.averageLLMLatencyMs).toBe(400.0);
    expect(summary.averageTTSLatencyMs).toBe(250.0);
    expect(summary.averageTotalTurnLatencyMs).toBe(800.0);
    expect(summary.successRatePercentage).toBe(50.0);
    expect(summary.cancellationRatePercentage).toBe(50.0);
  });
});
