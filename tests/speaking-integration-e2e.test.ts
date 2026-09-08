import { describe, it, expect, beforeEach, vi } from "vitest";
import { SpeakingPipelineOrchestrator } from "@/server/speech/speaking-pipeline-orchestrator";
import { SpeakingStateMachine } from "@/server/speech/speaking-state-machine";
import { SpeakingTelemetryTracker } from "@/server/speech/speaking-telemetry";
import { ConversationService } from "@/server/services/conversation-service";
import { EnglishAnalysisService } from "@/server/services/english-analysis-service";
import { MockSTTProvider } from "@/server/providers/stt/mock-stt.provider";
import { MockTTSProvider } from "@/server/providers/tts/mock-tts.provider";

const VALID_UUID_USER = "12345678-1234-4234-8234-123456789abc";
const VALID_UUID_CONV = "87654321-4321-4234-8234-987654321abc";

describe("End-to-End Speaking Flow Integration Test", () => {
  let orchestrator: SpeakingPipelineOrchestrator;
  let stateMachine: SpeakingStateMachine;
  let telemetry: SpeakingTelemetryTracker;

  beforeEach(() => {
    vi.restoreAllMocks();
    stateMachine = new SpeakingStateMachine();
    telemetry = new SpeakingTelemetryTracker();

    const mockConvService = new ConversationService();
    vi.spyOn(mockConvService, "processUserTurn").mockResolvedValue({
      turnId: "t-0",
      conversationId: VALID_UUID_CONV,
      speaker: "user",
      text: "User text",
      turnOrder: 1,
      createdAt: new Date(),
    });
    vi.spyOn(mockConvService, "generateAssistantTurn").mockResolvedValue({
      turnId: "t-100",
      conversationId: VALID_UUID_CONV,
      turnOrder: 1,
      speaker: "assistant",
      text: "I understand you want to discuss technology. What area interests you most?",
      createdAt: new Date(),
    });

    const mockAnalysisService = new EnglishAnalysisService();
    vi.spyOn(mockAnalysisService, "analyzeEnglish").mockResolvedValue({
      classificationState: "grammatically_correct_and_natural",
      isCompletelyCorrect: true,
      overallSummary: "Good job",
      deterministicStats: {
        wordCount: 5,
        sentenceCount: 1,
        typeTokenRatio: 1.0,
        fillerCount: 0,
        detectedFillers: [],
        wordsPerMinute: null,
        pauseCount: null,
        totalPauseDurationSecs: null,
      },
      highConfidenceIssues: [],
      mediumConfidenceIssues: [],
      filteredLowConfidenceCount: 0,
      usefulVocabularyEncounters: [],
      analyzedAt: new Date(),
    });

    orchestrator = new SpeakingPipelineOrchestrator(
      stateMachine,
      telemetry,
      mockConvService,
      mockAnalysisService,
      new MockSTTProvider(),
      new MockTTSProvider()
    );

    stateMachine.transitionTo("READY");
  });

  it("should execute deterministic record -> transcribe -> respond -> analyze -> persist pipeline", async () => {
    // Simulate user audio recording Blob
    const fakeAudioBlob = new Blob(["fake-audio-bytes"], { type: "audio/webm" });

    // Step 1: Start turn processing (RECORDING -> TRANSCRIBING -> THINKING -> SPEAKING)
    const result = await orchestrator.processTurn({
      userId: VALID_UUID_USER,
      conversationId: VALID_UUID_CONV,
      audioBlob: fakeAudioBlob,
    });

    // Step 2: Verify transcript produced by mock STT
    expect(result.turn.userText).toBeDefined();
    expect(result.turn.userText.length).toBeGreaterThan(0);

    // Step 3: Verify assistant turn response produced by conversation engine
    expect(result.turn.assistantText).toContain("technology");

    // Step 4: Verify TTS audio synthesis produced audio Blob
    expect(result.audioBuffer).toBeDefined();
    expect(result.ttsFailed).toBe(false);

    // Step 5: Verify background analysis was triggered
    expect(result.analysisPromise).toBeDefined();
    await result.analysisPromise;

    // Step 6: Verify telemetry logging
    const summary = telemetry.getSummary();
    expect(summary.totalTurnsRecorded).toBe(1);
    expect(summary.successRatePercentage).toBe(100);
    expect(summary.averageSTTLatencyMs).toBeGreaterThanOrEqual(0);
    expect(summary.averageLLMLatencyMs).toBeGreaterThanOrEqual(0);
    expect(summary.averageTTSLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
