import { speakingStateMachine, SpeakingStateMachine } from "./speaking-state-machine";
import { speakingTelemetryTracker, SpeakingTelemetryTracker } from "./speaking-telemetry";
import { conversationService, ConversationService } from "../services/conversation-service";
import { englishAnalysisService, EnglishAnalysisService } from "../services/english-analysis-service";
import { STTProvider } from "../providers/stt/stt-provider.interface";
import { TTSProvider } from "../providers/tts/tts-provider.interface";
import { MockSTTProvider } from "../providers/stt/mock-stt.provider";
import { HuggingFaceSTTProvider } from "../providers/stt/huggingface-stt.provider";
import { MockTTSProvider } from "../providers/tts/mock-tts.provider";
import { SpeakingTurn, AnalysisStatus } from "@/domain/speech/speaking-session.schema";
import { AppError } from "@/lib/errors/app-error";
import { config } from "@/lib/config/env";
import { logger } from "@/lib/logger/logger";

export interface ProcessTurnParams {
  userId: string;
  conversationId: string;
  audioBlob?: Blob | undefined;
  rawText?: string | undefined;
  sttProvider?: STTProvider;
  ttsProvider?: TTSProvider;
  abortSignal?: AbortSignal;
}

export interface ProcessTurnResult {
  turn: SpeakingTurn;
  audioBuffer?: Blob | undefined;
  audioUrl?: string | undefined;
  ttsFailed: boolean;
  analysisPromise?: Promise<void>;
}

export class SpeakingPipelineOrchestrator {
  private activeAbortController: AbortController | null = null;
  private currentTurnId: string | null = null;

  constructor(
    private readonly stateMachine: SpeakingStateMachine = speakingStateMachine,
    private readonly telemetry: SpeakingTelemetryTracker = speakingTelemetryTracker,
    private readonly convService: ConversationService = conversationService,
    private readonly analysisService: EnglishAnalysisService = englishAnalysisService,
    private readonly defaultSTT: STTProvider = new MockSTTProvider(),
    private readonly defaultTTS: TTSProvider = new MockTTSProvider()
  ) {}

  /**
   * Cancels any active turn request currently in progress.
   */
  public cancelActiveTurn(reason = "Turn cancelled by user action"): void {
    const turnId = this.currentTurnId;
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    if (turnId) {
      logger.info("Cancelled active turn operation", { turnId, reason });
      this.telemetry.recordTurnTelemetry({
        turnId,
        sttLatencyMs: 0,
        llmLatencyMs: 0,
        ttsLatencyMs: 0,
        totalTurnLatencyMs: 0,
        isCancelled: true,
        isSuccess: false,
        errorMessage: reason,
      });
      this.currentTurnId = null;
    }

    if (this.stateMachine.getState() !== "IDLE" && this.stateMachine.getState() !== "READY") {
      this.stateMachine.reset("READY");
    }
  }

  /**
   * Triggers immediate barge-in interruption when user speaks during assistant playback.
   */
  public interruptCurrentTurn(): void {
    const activeState = this.stateMachine.getState();
    const turnId = this.currentTurnId ?? crypto.randomUUID();

    if (this.activeAbortController || this.currentTurnId) {
      this.cancelActiveTurn("Barge-in interruption by user speech");
    } else {
      this.telemetry.recordTurnTelemetry({
        turnId,
        sttLatencyMs: 0,
        llmLatencyMs: 0,
        ttsLatencyMs: 0,
        totalTurnLatencyMs: 0,
        isCancelled: true,
        isSuccess: false,
        errorMessage: "Barge-in interruption by user speech",
      });
    }

    if (activeState === "SPEAKING" || activeState === "THINKING" || activeState === "RECORDING" || activeState === "TRANSCRIBING") {
      this.stateMachine.transitionTo("INTERRUPTED", "Barge-in interruption");
    }
  }

  /**
   * Executes full user turn pipeline with concurrency locks, partial failure handling, and telemetry.
   */
  async processTurn(params: ProcessTurnParams): Promise<ProcessTurnResult> {
    // 1. Cancel any stale/previous turn task
    this.cancelActiveTurn("Superseded by new turn request");

    const abortController = new AbortController();
    this.activeAbortController = abortController;
    const signal = params.abortSignal ?? abortController.signal;

    const turnId = crypto.randomUUID();
    this.currentTurnId = turnId;

    const startTime = Date.now();
    let sttLatencyMs = 0;
    let llmLatencyMs = 0;
    let ttsLatencyMs = 0;

    try {
      // 2. Speech-to-Text Stage
      this.stateMachine.transitionTo("TRANSCRIBING", "Processing STT");
      let userTranscript = params.rawText?.trim() ?? "";

      if (!userTranscript && params.audioBlob) {
        const sttStart = Date.now();
        const sttProvider =
          params.sttProvider ??
          (config.STT_PROVIDER === "whisper" && config.HF_TOKEN && process.env.NODE_ENV !== "test"
            ? new HuggingFaceSTTProvider()
            : this.defaultSTT);
        const arrayBuffer = await params.audioBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = params.audioBlob.type || "audio/webm";
        const sttResult = await sttProvider.transcribeBuffer(buffer, mimeType, {
          language: "en",
        });
        sttLatencyMs = Date.now() - sttStart;
        userTranscript = sttResult.fullText.trim();
      }

      this.checkCancellation(signal, turnId);

      if (!userTranscript) {
        throw AppError.validation("STT failed to produce valid transcript text.");
      }

      // 3. Conversation Engine / LLM Stage
      this.stateMachine.transitionTo("THINKING", "Generating assistant response");
      const llmStart = Date.now();

      await this.convService.processUserTurn(
        params.conversationId,
        userTranscript
      );

      const assistantTurnResult = await this.convService.generateAssistantTurn(
        params.conversationId
      );

      llmLatencyMs = Date.now() - llmStart;
      const assistantText = assistantTurnResult.text;

      this.checkCancellation(signal, turnId);

      // 4. Text-to-Speech (TTS) Stage (Partial failure recoverable)
      this.stateMachine.transitionTo("SPEAKING", "Synthesizing and playing assistant TTS audio");
      const ttsStart = Date.now();
      let audioBuffer: Blob | undefined;
      let ttsFailed = false;

      try {
        const ttsProvider = params.ttsProvider ?? this.defaultTTS;
        const ttsResult = await ttsProvider.synthesizeSpeech(assistantText, {
          voiceId: "en-US-Standard-C",
        });
        ttsLatencyMs = Date.now() - ttsStart;
        audioBuffer = new Blob([Uint8Array.from(ttsResult.audioBuffer)], { type: ttsResult.contentType });
      } catch (err) {
        ttsFailed = true;
        ttsLatencyMs = Date.now() - ttsStart;
        logger.warn("TTS synthesis failed for turn, falling back to text-only display", { turnId }, err);
      }

      this.checkCancellation(signal, turnId);

      // 5. English Linguistic Analysis Execution
      let analysisResult: unknown = undefined;
      let analysisStatus: AnalysisStatus = "completed";
      try {
        analysisResult = await this.analysisService.analyzeEnglish({
          transcript: userTranscript,
        });
      } catch (analysisErr) {
        analysisStatus = "failed";
        logger.warn("Linguistic analysis failed for turn", { turnId }, analysisErr);
      }

      // 6. Build SpeakingTurn object
      const totalTurnLatencyMs = Date.now() - startTime;
      const turn: SpeakingTurn = {
        id: turnId,
        conversationId: params.conversationId,
        turnOrder: assistantTurnResult.turnOrder,
        userText: userTranscript,
        assistantText,
        sttDurationMs: sttLatencyMs,
        llmDurationMs: llmLatencyMs,
        ttsDurationMs: ttsLatencyMs,
        ttsFailed,
        analysisStatus,
        analysis: analysisResult,
        createdAt: new Date(),
      };

      // 7. Record telemetry metrics
      this.telemetry.recordTurnTelemetry({
        turnId,
        sttLatencyMs,
        llmLatencyMs,
        ttsLatencyMs,
        totalTurnLatencyMs,
        isCancelled: false,
        isSuccess: true,
      });

      this.activeAbortController = null;
      this.currentTurnId = null;

      return {
        turn,
        audioBuffer,
        ttsFailed,
        analysisPromise: Promise.resolve(),
      };
    } catch (error) {
      const err = error as Error;
      if (err.name === "AbortError" || signal.aborted) {
        logger.info("Speaking pipeline task aborted cleanly", { turnId });
        throw AppError.internal("Speaking turn was cancelled");
      }

      this.stateMachine.transitionTo("ERROR", err.message);
      this.telemetry.recordTurnTelemetry({
        turnId,
        sttLatencyMs,
        llmLatencyMs,
        ttsLatencyMs,
        totalTurnLatencyMs: Date.now() - startTime,
        isCancelled: false,
        isSuccess: false,
        errorMessage: err.message,
      });

      this.activeAbortController = null;
      this.currentTurnId = null;
      throw error;
    }
  }

  /**
   * Non-blocking background linguistic analysis execution.
   */
  private async runBackgroundAnalysis(params: {
    userId: string;
    transcript: string;
    conversationId: string;
    turnId: string;
  }): Promise<void> {
    try {
      await this.analysisService.analyzeEnglish({
        transcript: params.transcript,
      });
      logger.info("Background linguistic analysis completed for turn", { turnId: params.turnId });
    } catch (err) {
      logger.warn("Background analysis failed for turn (can be retried)", { turnId: params.turnId }, err);
    }
  }

  private checkCancellation(signal: AbortSignal, turnId: string): void {
    if (signal.aborted || this.currentTurnId !== turnId) {
      const error = new Error("Operation cancelled by newer turn or user action");
      error.name = "AbortError";
      throw error;
    }
  }
}

export const speakingPipelineOrchestrator = new SpeakingPipelineOrchestrator();
