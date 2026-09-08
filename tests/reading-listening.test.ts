import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReadingService } from "@/server/services/reading-service";
import { ListeningService } from "@/server/services/listening-service";
import { ComprehensionEvaluator } from "@/server/analysis/comprehension-evaluator";
import { VocabularyService } from "@/server/services/vocabulary-service";
import { MockSTTProvider } from "@/server/providers/stt/mock-stt.provider";

const VALID_UUID_USER = "12345678-1234-4234-8234-123456789abc";

describe("Reading & Listening Subsystems", () => {
  let readingService: ReadingService;
  let listeningService: ListeningService;
  let evaluator: ComprehensionEvaluator;
  let mockVocabService: VocabularyService;

  beforeEach(() => {
    mockVocabService = new VocabularyService();
    vi.spyOn(mockVocabService, "extractAndTrackVocabulary").mockResolvedValue([]);

    readingService = new ReadingService(mockVocabService);
    listeningService = new ListeningService(new MockSTTProvider(), mockVocabService);
    evaluator = new ComprehensionEvaluator();
  });

  describe("1. Reading Analysis & Vocabulary Connection", () => {
    it("should process reading passages and extract ENCOUNTERED vocabulary", async () => {
      const passageText =
        "Astronomy is the scientific study of celestial objects and phenomena. Astronomers observe planets, stars, galaxies, and black holes to understand the universe.";

      const item = await readingService.processReadingPassage({
        userId: VALID_UUID_USER,
        passageText,
        sourceType: "pasted",
      });

      expect(item.id).toBeDefined();
      expect(item.wordCount).toBeGreaterThan(15);
      expect(item.questions.length).toBe(5); // 5 core question types
      expect(item.encounteredVocabulary.length).toBeGreaterThan(0);

      // Verify vocabulary was passed to vocab service
      expect(mockVocabService.extractAndTrackVocabulary).toHaveBeenCalled();
    });
  });

  describe("2. Comprehension & Semantic Equivalence Evaluation", () => {
    it("should evaluate multiple choice questions deterministically", async () => {
      const question = {
        id: "12345678-1234-4234-8234-123456789abc",
        type: "explicit_information" as const,
        questionText: "What color is the sky?",
        options: ["Option A: Blue", "Option B: Green", "Option C: Red"],
        referenceAnswer: "Option A: Blue",
        acceptableConcepts: ["blue"],
        explanation: "Stated directly.",
      };

      const result = await evaluator.evaluateAnswer(question, "Option A: Blue");
      expect(result.isCorrect).toBe(true);
      expect(result.scorePercentage).toBe(100);
    });

    it("should allow semantic equivalence for open answers without false negatives for different wording", async () => {
      const question = {
        id: "87654321-4321-4234-8234-987654321abc",
        type: "inference" as const,
        questionText: "Why did the character leave early?",
        referenceAnswer: "The character departed early because they had an urgent appointment.",
        acceptableConcepts: ["urgent appointment", "important meeting"],
        explanation: "Inferred from context.",
      };

      // User provides paraphrased answer with different wording ("important meeting" instead of "urgent appointment")
      const result = await evaluator.evaluateAnswer(question, "He left because he had an important meeting.");

      expect(result.isCorrect).toBe(true);
      expect(result.isSemanticallyEquivalent).toBe(true);
      expect(result.scorePercentage).toBe(100);
      expect(result.matchedConcepts).toContain("important meeting");
    });
  });

  describe("3. Listening Subsystem & Transcript-Hidden Mode", () => {
    it("should process audio in Transcript-Hidden Mode by default", async () => {
      const fakeAudioBuffer = Buffer.from("fake-audio-recording");

      const item = await listeningService.processListeningAudio({
        userId: VALID_UUID_USER,
        audioBuffer: fakeAudioBuffer,
        mimeType: "audio/webm",
      });

      expect(item.id).toBeDefined();
      expect(item.isTranscriptHidden).toBe(true); // Transcript hidden before attempt!
      expect(item.transcriptionText).toBeDefined();
      expect(item.questions.length).toBeGreaterThan(0);
    });

    it("should reveal transcript after attempt with highlighted vocabulary and missed info", async () => {
      const item = await listeningService.processListeningAudio({
        userId: VALID_UUID_USER,
        rawText: "The team completed the mission successfully ahead of schedule.",
      });

      const reveal = listeningService.revealTranscript(item.id);

      expect(reveal.listeningItemId).toBe(item.id);
      expect(reveal.fullTranscript).toBe("The team completed the mission successfully ahead of schedule.");
      expect(reveal.highlightedVocabulary.length).toBeGreaterThan(0);
      expect(reveal.highlightedExpressions.length).toBeGreaterThan(0);
    });

    it("should bridge listening item into a shadowing exercise without content duplication", async () => {
      const item = await listeningService.processListeningAudio({
        userId: VALID_UUID_USER,
        rawText: "Practice shadowing this sentence for rhythm.",
      });

      const shadowBridge = listeningService.linkToShadowing(item.id);

      expect(shadowBridge.listeningItemId).toBe(item.id);
      expect(shadowBridge.shadowingItemId).toContain(item.id);
      expect(shadowBridge.promptText).toBe("Practice shadowing this sentence for rhythm.");
    });
  });
});
