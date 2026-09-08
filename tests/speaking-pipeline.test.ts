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

describe("Speaking Pipeline Orchestrator", () => {
  let orchestrator: SpeakingPipelineOrchestrator;
  let stateMachine: SpeakingStateMachine;
  let telemetry: SpeakingTelemetryTracker;
  let mockConvService: ConversationService;
  let mockAnalysisService: EnglishAnalysisService;

  beforeEach(() => {
    vi.restoreAllMocks();
    stateMachine = new SpeakingStateMachine();
    telemetry = new SpeakingTelemetryTracker();

    mockConvService = new ConversationService();
    vi.spyOn(mockConvService, "processUserTurn").mockResolvedValue({
      turnId: "t-0",
      conversationId: VALID_UUID_CONV,
      speaker: "user",
      text: "User text",
      turnOrder: 1,
      createdAt: new Date(),
    });
    vi.spyOn(mockConvService, "generateAssistantTurn").mockResolvedValue({
      turnId: "t-1",
      conversationId: VALID_UUID_CONV,
      turnOrder: 2,
      speaker: "assistant",
      text: "Hello! How can I help you practice English today?",
      createdAt: new Date(),
    });

    mockAnalysisService = new EnglishAnalysisService();
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

  it("should process a full user turn and return assistant response with telemetry", async () => {
    const result = await orchestrator.processTurn({
      userId: VALID_UUID_USER,
      conversationId: VALID_UUID_CONV,
      rawText: "I want to practice my English speaking skills.",
    });

    expect(result.turn.userText).toBe("I want to practice my English speaking skills.");
    expect(result.turn.assistantText).toContain("Hello!");
    expect(result.ttsFailed).toBe(false);
    expect(result.audioBuffer).toBeDefined();

    const summary = telemetry.getSummary();
    expect(summary.totalTurnsRecorded).toBe(1);
    expect(summary.successRatePercentage).toBe(100);
  });

  it("should handle barge-in interruption cleanly without crashing state machine", () => {
    stateMachine.transitionTo("RECORDING");
    stateMachine.transitionTo("TRANSCRIBING");
    stateMachine.transitionTo("THINKING");
    stateMachine.transitionTo("SPEAKING");

    orchestrator.interruptCurrentTurn();

    expect(stateMachine.getState()).toBe("INTERRUPTED");
    const summary = telemetry.getSummary();
    expect(summary.cancellationRatePercentage).toBe(100);
  });

  it("should handle partial TTS failure gracefully without invalidating conversation turn", async () => {
    const failingTTS = new MockTTSProvider();
    vi.spyOn(failingTTS, "synthesizeSpeech").mockRejectedValue(new Error("TTS Engine Unavailable"));

    const result = await orchestrator.processTurn({
      userId: VALID_UUID_USER,
      conversationId: VALID_UUID_CONV,
      rawText: "Test partial TTS failure.",
      ttsProvider: failingTTS,
    });

    expect(result.turn.userText).toBe("Test partial TTS failure.");
    expect(result.turn.assistantText).toBeDefined();
    expect(result.ttsFailed).toBe(true); // TTS failed, but text response returned successfully!
  });
});
