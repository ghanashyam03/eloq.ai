import { describe, it, expect, beforeEach } from "vitest";
import { FluencyAnalyzer } from "@/server/analysis/fluency-analyzer";
import { PhonemeAnalyzer } from "@/server/analysis/phoneme-analyzer";
import { PronunciationAnalysisService } from "@/server/services/pronunciation-analysis-service";
import { MockSpeechAnalysisProvider } from "@/server/providers/speech-analysis/mock-speech-analysis-provider";
import {
  FIXTURE_TIMESTAMPS_WITH_PAUSES,
  FIXTURE_TEXT_WITH_FILLERS,
  FIXTURE_TEXT_WITH_REPETITIONS,
  FIXTURE_PHONEME_ALIGNMENTS,
} from "./fixtures/speech-analysis.fixtures";

const VALID_UUID_USER = "12345678-1234-4234-8234-123456789abc";

describe("Pronunciation & Speech-Quality Analysis Subsystem", () => {
  let fluencyAnalyzer: FluencyAnalyzer;
  let phonemeAnalyzer: PhonemeAnalyzer;
  let service: PronunciationAnalysisService;
  let mockProvider: MockSpeechAnalysisProvider;

  beforeEach(() => {
    fluencyAnalyzer = new FluencyAnalyzer();
    phonemeAnalyzer = new PhonemeAnalyzer();
    mockProvider = new MockSpeechAnalysisProvider();
    service = new PronunciationAnalysisService(mockProvider, fluencyAnalyzer, phonemeAnalyzer);
  });

  describe("1. Capability Model & NOT_AVAILABLE Handling", () => {
    it("should return NOT_AVAILABLE for phoneme accuracy when provider lacks phoneme alignment capability", async () => {
      mockProvider.setMockConfig({
        capabilities: { supportsPhonemeAlignment: false },
      });

      const result = await service.analyzePronunciation({
        userId: VALID_UUID_USER,
        transcript: "Hello world",
      });

      expect(result.phonemeAnalysis.status).toBe("NOT_AVAILABLE");
      expect(result.phonemeAnalysis.phonemeAccuracyScore).toBeNull();
      expect(result.phonemeAnalysis.note).toContain("unavailable");
    });

    it("should return NOT_AVAILABLE for pause metrics when word timestamps are absent", () => {
      const pauses = fluencyAnalyzer.calculatePauseMetrics(undefined);
      expect(pauses.status).toBe("NOT_AVAILABLE");
      expect(pauses.pauseCount).toBeUndefined();
    });
  });

  describe("2. Speech Rate (WPM) Calculation", () => {
    it("should calculate WPM strictly from active speaking duration excluding initial silence", () => {
      // 6 words over 4000ms (4 seconds) = 90 WPM
      const rate = fluencyAnalyzer.calculateSpeechRate(6, FIXTURE_TIMESTAMPS_WITH_PAUSES);
      expect(rate.status).toBe("AVAILABLE");
      expect(rate.wpm).toBe(90);
      expect(rate.speakingDurationMs).toBe(4000);
    });

    it("should return NOT_AVAILABLE when duration or timestamps are unavailable", () => {
      const rate = fluencyAnalyzer.calculateSpeechRate(10, undefined, undefined);
      expect(rate.status).toBe("NOT_AVAILABLE");
      expect(rate.wpm).toBeNull();
    });
  });

  describe("3. Pause Gap Analysis", () => {
    it("should detect pause gaps, pause count, average duration, and longest pause from timestamps", () => {
      const pauses = fluencyAnalyzer.calculatePauseMetrics(FIXTURE_TIMESTAMPS_WITH_PAUSES, 350);
      expect(pauses.status).toBe("AVAILABLE");
      expect(pauses.pauseCount).toBe(2);
      expect(pauses.totalPauseDurationMs).toBe(1800); // 800ms + 1000ms
      expect(pauses.averagePauseDurationMs).toBe(900);
      expect(pauses.longestPauseDurationMs).toBe(1000);
    });
  });

  describe("4. Filler Classification", () => {
    it("should separate hesitation fillers from discourse markers", () => {
      const fillers = fluencyAnalyzer.analyzeFillers(FIXTURE_TEXT_WITH_FILLERS);
      expect(fillers.hesitationCount).toBe(2); // "Um", "uh"
      expect(fillers.discourseMarkerCount).toBe(2); // "actually", "you know"

      const hesitations = fillers.items.filter((i) => i.type === "hesitation_filler");
      const discourseMarkers = fillers.items.filter((i) => i.type === "discourse_marker");

      expect(hesitations.every((i) => i.isProblematic)).toBe(true);
      expect(discourseMarkers.every((i) => !i.isProblematic)).toBe(true); // Single usage is not flagged problematic
    });
  });

  describe("5. Repetition Detection", () => {
    it("should detect word repetitions and mark excessive repetitions", () => {
      const repetitions = fluencyAnalyzer.analyzeRepetitions(FIXTURE_TEXT_WITH_REPETITIONS);
      expect(repetitions.totalRepetitions).toBeGreaterThan(0);
      expect(repetitions.items.some((i) => i.repeatedText.includes("to to"))).toBe(true);
    });
  });

  describe("6. Phoneme Alignment & Accuracy", () => {
    it("should calculate exact phoneme accuracy when alignment evidence is supplied by audio provider", () => {
      const caps = {
        supportsPhonemeAlignment: true,
        supportsWordTimestamps: true,
        supportsPitch: false,
        supportsEnergy: false,
        supportsSpeechRate: true,
        providerName: "test_provider",
      };

      const result = phonemeAnalyzer.analyzePhonemes(caps, FIXTURE_PHONEME_ALIGNMENTS);
      expect(result.status).toBe("AVAILABLE");
      expect(result.phonemeAccuracyScore).toBe(0.75); // 3 out of 4 correct
      expect(result.totalPhonemesEvaluated).toBe(4);
      expect(result.problemPhonemes).toContain("k");
    });
  });

  describe("7. Full Service Integration", () => {
    it("should execute deterministic record -> analyze flow with validated schema", async () => {
      mockProvider.setMockConfig({
        capabilities: {
          supportsPhonemeAlignment: true,
          supportsWordTimestamps: true,
          supportsSpeechRate: true,
        },
        cannedPhonemes: FIXTURE_PHONEME_ALIGNMENTS,
      });

      const analysis = await service.analyzePronunciation({
        userId: VALID_UUID_USER,
        transcript: "I am practicing my English speaking.",
        wordTimestamps: FIXTURE_TIMESTAMPS_WITH_PAUSES,
      });

      expect(analysis.analysisId).toBeDefined();
      expect(analysis.isAudioBased).toBe(true);
      expect(analysis.fluencyProfile.speechRateStatus).toBe("AVAILABLE");
      expect(analysis.phonemeAnalysis.status).toBe("AVAILABLE");
      expect(analysis.phonemeAnalysis.phonemeAccuracyScore).toBe(0.75);
      expect(analysis.targetedSkills.length).toBeGreaterThan(0);
    });
  });
});
