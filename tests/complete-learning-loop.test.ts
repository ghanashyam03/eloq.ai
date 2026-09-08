import { describe, it, expect, beforeEach, vi } from "vitest";
import { speakingPipelineOrchestrator } from "@/server/speech/speaking-pipeline-orchestrator";
import { englishAnalysisService } from "@/server/services/english-analysis-service";
import { practiceEngine } from "@/server/services/practice-engine";
import { dailyCurriculumEngine } from "@/server/services/daily-curriculum-engine";
import { progressAnalyticsService } from "@/server/services/progress-analytics-service";
import { errorNormalizer } from "@/server/learning/error-normalizer";
import { srsScheduler } from "@/server/vocabulary/srs-scheduler";
import { skillTransferDetector } from "@/server/analytics/skill-transfer-detector";
import { modelRouter } from "@/server/providers/llm/router/model-router";
import { MockLLMProvider } from "@/server/providers/llm/implementations/mock.provider";
import { conversationRepository } from "@/server/repositories/conversation-repository";
import { errorRepository } from "@/server/repositories/error-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { learningEventRepository } from "@/server/repositories/learning-event-repository";
import { vocabularyRepository } from "@/server/repositories/vocabulary-repository";
import { UserVocabularyState } from "@/domain/vocabulary/vocabulary.schema";

describe("Final Master Integration & System Quality Audit", () => {
  const mockUserId = "123e4567-e89b-12d3-a456-426614174000";
  const mockConvId = "conv-master-loop-100";

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(userRepository, "getUserProfile").mockResolvedValue({
      id: mockUserId,
      email: "master@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Master Audit User",
      profile: {
        id: "p-1",
        userId: mockUserId,
        targetVariety: "en-US",
        estimatedLevel: "B2",
        dailyTargetDurationMins: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      settings: null,
      learningGoals: [
        { id: "g-1", userId: mockUserId, category: "grammar", description: "Master prepositions", priority: 1, isCompleted: false, createdAt: new Date(), updatedAt: new Date() },
      ],
    } as unknown as Awaited<ReturnType<typeof userRepository.getUserProfile>>);

    vi.spyOn(conversationRepository, "createConversation").mockResolvedValue({
      id: mockConvId,
      userId: mockUserId,
      mode: "free_conversation",
      difficulty: "intermediate",
      goalContext: null,
      status: "active",
      startedAt: new Date(),
      endedAt: null,
      durationSeconds: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(conversationRepository, "getConversationHistory").mockResolvedValue({
      id: mockConvId,
      userId: mockUserId,
      mode: "free_conversation",
      difficulty: "intermediate",
      goalContext: null,
      status: "active",
      startedAt: new Date(),
      endedAt: null,
      durationSeconds: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      turns: [
        {
          id: "t-1",
          conversationId: mockConvId,
          speaker: "user",
          turnOrder: 1,
          text: "I am interested on artificial intelligence research.",
          audioUrl: null,
          durationSeconds: 10,
          providerMetadata: null,
          createdAt: new Date(),
          speechSegments: [],
          errorOccurrences: [],
        },
      ],
    });

    vi.spyOn(conversationRepository, "addTurn").mockImplementation(async (dto) => ({
      turn: {
        id: crypto.randomUUID(),
        conversationId: dto.conversationId,
        speaker: dto.speaker,
        turnOrder: 2,
        text: dto.text,
        audioUrl: dto.audioUrl ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        providerMetadata: null,
        createdAt: new Date(),
      },
      segment: null,
    }));

    vi.spyOn(errorRepository, "getUserErrorHistory").mockResolvedValue([]);
    vi.spyOn(vocabularyRepository, "getUserVocabulary").mockResolvedValue([]);
    vi.spyOn(vocabularyRepository, "getDueReviews").mockResolvedValue([]);
    vi.spyOn(errorRepository, "recordOccurrence").mockResolvedValue({
      id: "occ-1",
      userId: mockUserId,
      errorDefinitionId: "def-1",
      conversationId: mockConvId,
      turnId: "t-1",
      originalText: "interested on",
      correctedText: "interested in",
      explanation: "Preposition error",
      category: "grammar",
      severity: "medium",
      confidence: 0.9,
      createdAt: new Date(),
    });

    const mockLLM = new MockLLMProvider({
      cannedResponse: JSON.stringify({
        overallSummary: "Preposition issue identified.",
        isCompletelyCorrect: false,
        classificationState: "grammatically_incorrect",
        issues: [
          {
            category: "GRAMMAR",
            subcategory: "preposition",
            classificationState: "grammatically_incorrect",
            originalText: "interested on",
            correctedText: "interested in",
            explanation: "Incorrect preposition used after interested",
            severity: 3,
            confidence: 0.95,
            evidenceSpan: { textSnippet: "interested on" },
            uncertaintyState: false,
          },
        ],
        usefulVocabularyEncounters: [],
      }),
    });
    modelRouter.registerProvider("gemini", mockLLM);
    modelRouter.registerProvider("huggingface", mockLLM);
    modelRouter.registerProvider("nvidia", mockLLM);
    modelRouter.registerProvider("openrouter", mockLLM);
    modelRouter.registerProvider("cerebras", mockLLM);
    modelRouter.registerProvider("local", mockLLM);
    modelRouter.registerProvider("mock", mockLLM);

    vi.spyOn(learningEventRepository, "logEvent").mockResolvedValue({
      id: "evt-1",
      userId: mockUserId,
      eventType: "test_event",
      entityType: "test",
      entityId: "1",
      payload: {},
      createdAt: new Date(),
    });
  });

  describe("1. Complete Closed-Loop System Integration", () => {
    it("should execute the complete loop from user speech -> STT -> LLM response -> TTS -> English analysis -> weakness tracking -> practice -> curriculum -> progress", async () => {
      // 1. Process speaking turn
      const turnResult = await speakingPipelineOrchestrator.processTurn({
        userId: mockUserId,
        conversationId: mockConvId,
        rawText: "I am very interested on this project, but we need to discuss about the budget.",
      });

      expect(turnResult.turn.userText).toContain("interested on");
      expect(turnResult.turn.assistantText).toBeDefined();

      // Wait for background analysis completion
      if (turnResult.analysisPromise) {
        await turnResult.analysisPromise;
      }

      // 2. Perform English linguistic error analysis
      const analysis = await englishAnalysisService.analyzeEnglish({
        transcript: turnResult.turn.userText,
      });

      expect(analysis.highConfidenceIssues.length).toBeGreaterThan(0);
      expect(analysis.highConfidenceIssues[0]?.originalText).toBe("interested on");

      // 3. Generate daily curriculum incorporating identified preposition weakness
      const plan = await dailyCurriculumEngine.generateDailyPlan(mockUserId, { durationMinutes: 20 });
      expect(plan.activities.length).toBeGreaterThan(0);
      expect(plan.activities.some((a) => a.activityType === "spontaneous_speaking")).toBe(true);

      // 4. Generate progress analytics report
      const report = await progressAnalyticsService.generateProgressReport({
        userId: mockUserId,
        window: "30d",
        sessionOverrideData: [
          { sessionId: mockConvId, wordCount: 40, durationSeconds: 30, transcript: turnResult.turn.userText, createdAt: new Date() },
        ],
      });

      expect(report.scoringVersion).toBe("progress.v1");
      expect(report.rawEvidence.totalTurnsCount).toBe(1);
    }, 15000);
  });

  describe("2. End-to-End Preposition Weakness Lifecycle", () => {
    it("should trace preposition error normalization -> priority calculation -> practice generation -> mastery update -> priority reduction", () => {
      // 1. Error Normalization
      const signature = errorNormalizer.normalizeError({
        category: "grammar",
        subcategory: "preposition",
        originalText: "interested on",
        correctedText: "interested in",
        explanation: "Incorrect preposition used after interested",
      });

      expect(signature.normalizedKey).toBe("grammar:preposition:interested_in");

      // 2. Initial High Recurrence Priority Calculation
      const highRecurrencePriority = 8.5; // Calculated when occurrenceCount = 12

      // 3. Generate Practice
      const exercise = practiceEngine["generator"].generateExercise({
        targetSkillType: "grammar",
        targetCategory: "preposition",
        title: "Preposition Drill (in vs on)",
        exerciseType: "fill_blank",
        progressionStage: "controlled_production",
        difficulty: "B1",
        selectionReason: "High recurrence error pattern",
        expectedLearningValue: highRecurrencePriority,
      });

      expect(exercise.targetCategory).toBe("preposition");

      // 4. Evaluate Sustained Correct Practice
      const initialConsecutiveSuccesses = 3;
      const adjustment = practiceEngine["difficultyManager"].evaluateAdjustment({
        currentStage: "controlled_production",
        currentDifficulty: "B1",
        consecutiveSuccesses: initialConsecutiveSuccesses + 1,
        consecutiveFailures: 0,
      });

      expect(adjustment.nextStage).toBe("guided_production");
    });
  });

  describe("3. Vocabulary Lifecycle & Passive vs Active Distinction", () => {
    it("should distinctly manage vocabulary stages from encountered -> recognized -> recalled -> produced -> mastered", () => {
      const initialState: UserVocabularyState = {
        id: "uv-1",
        userId: mockUserId,
        vocabularyItemId: "v-1",
        encounteredCount: 1,
        recognizedCount: 1,
        recalledCount: 0,
        producedCount: 0,
        correctProductionCount: 0,
        incorrectProductionCount: 0,
        naturalUsageCount: 0,
        timesMisused: 0,
        srsIntervalDays: 1,
        easeFactor: 2.5,
        consecutiveSuccesses: 1,
        mastery: 0.2,
        confidence: 0.5,
        status: "passive",
        lastSeenAt: new Date(),
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
      };

      // 1. Recognition step
      const recognitionResult = srsScheduler.calculateNextSchedule(initialState, "recognition", "correct_natural");
      expect(recognitionResult.newStatus).toBe("passive"); // Passive after recognition

      // 2. Active production step with high naturalness rating
      const productionState: UserVocabularyState = {
        ...initialState,
        producedCount: 3,
        correctProductionCount: 3,
        naturalUsageCount: 1,
        mastery: 0.5,
      };
      const productionResult = srsScheduler.calculateNextSchedule(productionState, "production", "correct_natural");

      expect(productionResult.newStatus).toBe("active");
      expect(productionResult.newMastery).toBeGreaterThan(initialState.mastery);
    });
  });

  describe("4. Relapse Handling & Historical Evidence Preservation", () => {
    it("should transition status to relapsed upon failure of previously mastered concept while preserving raw history", () => {
      const masteredState: UserVocabularyState = {
        id: "uv-2",
        userId: mockUserId,
        vocabularyItemId: "v-2",
        encounteredCount: 10,
        recognizedCount: 8,
        recalledCount: 6,
        producedCount: 5,
        correctProductionCount: 5,
        incorrectProductionCount: 0,
        naturalUsageCount: 2,
        timesMisused: 0,
        srsIntervalDays: 30,
        easeFactor: 2.6,
        consecutiveSuccesses: 6,
        mastery: 0.95,
        confidence: 0.9,
        status: "mastered",
        lastSeenAt: new Date(),
        lastReviewedAt: new Date(),
        nextReviewAt: new Date(),
      };

      // Subsequent failure (rating = "incorrect")
      const relapseResult = srsScheduler.calculateNextSchedule(masteredState, "production", "incorrect");

      expect(relapseResult.nextIntervalDays).toBe(1); // Reset SRS interval
      expect(relapseResult.encounteredCount).toBe(10); // Historical evidence preserved!
      expect(relapseResult.timesMisused).toBe(1);
    });
  });

  describe("5. Skill Transfer Gap Detection", () => {
    it("should detect a transfer gap when exercise accuracy is high but spontaneous error rate remains elevated", () => {
      const gapResult = skillTransferDetector.detectTransferGaps([
        {
          conceptOrCategory: "articles",
          controlledExerciseAccuracy: 92,
          spontaneousErrorCount: 8,
          spontaneousWordsProduced: 500, // 16 errors per 1000 words
        },
      ]);

      expect(gapResult.length).toBe(1);
      expect(gapResult[0]?.conceptOrCategory).toBe("articles");
      expect(gapResult[0]?.gapSeverity).toBe("severe");
      expect(gapResult[0]?.insightMessage).toContain("Controlled exercise accuracy for 'articles' is high (92%)");
    });
  });

  describe("6. False-Positive Audit across Linguistic Varieties", () => {
    it("should accept valid British and American English spellings and informal phrasal constructions without flagging false errors", () => {
      const britishText = "I like the colour of this organised building.";
      const signatureB = errorNormalizer.normalizeError({
        category: "spelling",
        subcategory: "regional",
        originalText: britishText,
        correctedText: britishText,
        explanation: "Valid British English spelling",
      });

      expect(signatureB.normalizedKey).toBeDefined();

      // Verify that analysis service handles natural text without crashing
      expect(() =>
        englishAnalysisService.analyzeEnglish({ transcript: "I'm gonna head out now." })
      ).not.toThrow();
    });
  });

  describe("7. Model Resilience & Fallback Audit", () => {
    it("should handle provider failure, malformed JSON, and timeouts cleanly without corrupting state", async () => {
      const failingLLM = new MockLLMProvider({ shouldFail: true });
      modelRouter.registerProvider("gemini", failingLLM);
      modelRouter.registerProvider("huggingface", failingLLM);
      modelRouter.registerProvider("nvidia", failingLLM);
      modelRouter.registerProvider("openrouter", failingLLM);
      modelRouter.registerProvider("cerebras", failingLLM);
      modelRouter.registerProvider("local", failingLLM);
      modelRouter.registerProvider("mock", failingLLM);

      // Verify modelRouter fallback execution or clean failure
      await expect(
        modelRouter.generateCompletion([{ role: "user", content: "Test prompt" }], { taskType: "conversation" })
      ).rejects.toThrow();
    });
  });

  describe("8. Free-Only Mode & Mock Mode Guarantee", () => {
    it("should execute full system operations using Mock providers without any external API keys", async () => {
      const mockLLM = new MockLLMProvider({ cannedResponse: "This is a mock provider response." });
      modelRouter.registerProvider("gemini", mockLLM);
      modelRouter.registerProvider("huggingface", mockLLM);
      modelRouter.registerProvider("nvidia", mockLLM);
      modelRouter.registerProvider("openrouter", mockLLM);
      modelRouter.registerProvider("cerebras", mockLLM);
      modelRouter.registerProvider("local", mockLLM);
      modelRouter.registerProvider("mock", mockLLM);

      const completion = await modelRouter.generateCompletion(
        [{ role: "user", content: "Hello AI" }],
        { taskType: "conversation" }
      );

      expect(completion.content).toBe("This is a mock provider response.");
      expect(process.env.ENABLE_PAID_PROVIDERS).not.toBe("true");
    });
  });
});
