import { describe, it, expect, beforeEach, vi } from "vitest";
import { sessionAnomalyFilter } from "@/server/analytics/session-anomaly-filter";
import { trendCalculator } from "@/server/analytics/trend-calculator";
import { normalizedMetricsEngine } from "@/server/analytics/normalized-metrics";
import { skillTransferDetector } from "@/server/analytics/skill-transfer-detector";
import { insightGenerator } from "@/server/analytics/insight-generator";
import { progressAnalyticsService } from "@/server/services/progress-analytics-service";
import { SCORING_VERSION, UserProgressReportSchema } from "@/domain/progress/progress-analytics.schema";
import { weaknessProfileService } from "@/server/services/weakness-profile-service";
import { vocabularyService } from "@/server/services/vocabulary-service";
import { conversationRepository } from "@/server/repositories/conversation-repository";
import { errorRepository } from "@/server/repositories/error-repository";
import { practiceRepository } from "@/server/repositories/practice-repository";

describe("Long-Term Learning Analytics & Progress-Intelligence Subsystem", () => {
  const mockUserId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Session Anomaly Filter & Corrupted Data Exclusion", () => {
    it("should filter out corrupted, 0-word, provider failure, and loop sessions from progress scoring without deleting raw records", () => {
      const rawSessions = [
        { sessionId: "s1", wordCount: 25, durationSeconds: 20, transcript: "I enjoy reading books about technology and science.", createdAt: new Date() },
        { sessionId: "s2", wordCount: 0, durationSeconds: 1, transcript: "", createdAt: new Date() }, // Corrupted empty
        { sessionId: "s3", wordCount: 2, durationSeconds: 2, transcript: "Um yeah", createdAt: new Date() }, // Extremely short
        { sessionId: "s4", wordCount: 30, durationSeconds: 25, transcript: "STT_FAILURE provider timeout error", isCancelled: true, createdAt: new Date() }, // Provider failure
        { sessionId: "s5", wordCount: 15, durationSeconds: 10, transcript: "test test test test test test test test", createdAt: new Date() }, // Loop anomaly
        { sessionId: "s6", wordCount: 30, durationSeconds: 25, transcript: "We implemented microservices to scale our architecture.", createdAt: new Date() },
      ];

      const result = sessionAnomalyFilter.filterAnomalies(rawSessions);

      expect(result.cleanSessions.length).toBe(2);
      expect(result.filteredCount).toBe(4);
      expect(result.cleanSessions.map((s) => s.sessionId)).toEqual(["s1", "s6"]);
    });
  });

  describe("2. Trend Analysis & Single Outlier Protection", () => {
    it("should detect an Improving trend across chronologically ordered measurements", () => {
      const day = 86400000;
      const now = Date.now();
      const points = [
        { timestamp: new Date(now - 6 * day), value: 25 },
        { timestamp: new Date(now - 5 * day), value: 22 },
        { timestamp: new Date(now - 4 * day), value: 20 },
        { timestamp: new Date(now - 3 * day), value: 15 },
        { timestamp: new Date(now - 2 * day), value: 12 },
        { timestamp: new Date(now - 1 * day), value: 10 },
      ];

      // lowerIsBetter = true for error rates
      const trend = trendCalculator.calculateTrend(points, true, 3);
      expect(trend).toBe("improving");
    });

    it("should detect a Declining trend across chronologically ordered measurements", () => {
      const day = 86400000;
      const now = Date.now();
      const points = [
        { timestamp: new Date(now - 6 * day), value: 5 },
        { timestamp: new Date(now - 5 * day), value: 8 },
        { timestamp: new Date(now - 4 * day), value: 12 },
        { timestamp: new Date(now - 3 * day), value: 18 },
        { timestamp: new Date(now - 2 * day), value: 22 },
        { timestamp: new Date(now - 1 * day), value: 25 },
      ];

      const trend = trendCalculator.calculateTrend(points, true, 3);
      expect(trend).toBe("declining");
    });

    it("should protect against a single outlier session falsely triggering a Declining trend", () => {
      const day = 86400000;
      const now = Date.now();
      const points = [
        { timestamp: new Date(now - 6 * day), value: 10 },
        { timestamp: new Date(now - 5 * day), value: 11 },
        { timestamp: new Date(now - 4 * day), value: 9 },
        { timestamp: new Date(now - 3 * day), value: 40 }, // Single outlier bad session
        { timestamp: new Date(now - 2 * day), value: 10 },
        { timestamp: new Date(now - 1 * day), value: 9 },
      ];

      const trend = trendCalculator.calculateTrend(points, true, 3);
      expect(trend).toBe("stable");
    });

    it("should return insufficient_evidence when data volume or distinct session count is too low", () => {
      const points = [
        { timestamp: new Date(), value: 10 },
        { timestamp: new Date(), value: 12 },
      ];

      const trend = trendCalculator.calculateTrend(points, true, 3);
      expect(trend).toBe("insufficient_evidence");
    });
  });

  describe("3. Confidence Model & Normalized Metrics Engine", () => {
    it("should compute volume-backed confidence scores cleanly", () => {
      expect(trendCalculator.calculateConfidence(3)).toBeLessThan(0.3);
      expect(trendCalculator.calculateConfidence(25)).toBeGreaterThanOrEqual(0.3);
      expect(trendCalculator.calculateConfidence(100)).toBeGreaterThanOrEqual(0.7);
    });

    it("should calculate error rates per 1000 words and filler rates per minute accurately", () => {
      const errorsPer1000 = normalizedMetricsEngine.calculateErrorsPer1000Words(15, 500);
      expect(errorsPer1000).toBe(30.0); // 15 errors in 500 words = 30 per 1000

      const fillersPerMin = normalizedMetricsEngine.calculateFillersPerMinute(12, 120);
      expect(fillersPerMin).toBe(6.0); // 12 fillers in 2 mins = 6 per min
    });
  });

  describe("4. Skill Transfer Gap Detection", () => {
    it("should detect transfer gaps when controlled exercise accuracy is high but spontaneous error rate is elevated", () => {
      const gaps = skillTransferDetector.detectTransferGaps([
        {
          conceptOrCategory: "prepositions",
          controlledExerciseAccuracy: 90,
          spontaneousErrorCount: 6,
          spontaneousWordsProduced: 400, // 15 per 1000 words
        },
      ]);

      expect(gaps.length).toBe(1);
      expect(gaps[0]?.conceptOrCategory).toBe("prepositions");
      expect(gaps[0]?.gapSeverity).toBe("severe");
      expect(gaps[0]?.insightMessage).toContain("Controlled exercise accuracy for 'prepositions' is high (90%)");
    });
  });

  describe("5. Personal Insights Generation", () => {
    it("should generate evidence-backed insights comparing writing vs speaking article error rates", () => {
      const insights = insightGenerator.generateInsights({
        writingWords: 300,
        writingArticleErrors: 1, // 3.3 per 1000
        speakingWords: 300,
        speakingArticleErrors: 5, // 16.6 per 1000
        passiveVocabGrowth: 20,
        activeVocabGrowth: 2,
      });

      expect(insights.length).toBe(2);
      expect(insights[0]?.category).toBe("comparison");
      expect(insights[0]?.detailedObservation).toContain("fewer article errors during writing");
      expect(insights[1]?.category).toBe("vocabulary");
      expect(insights[1]?.headline).toBe("Active Vocabulary Lagging Passive Recognition");
    });
  });

  describe("6. Full Progress Analytics Service & Report Schema", () => {
    it("should generate a complete, valid UserProgressReport with score versioning and separate dimensions", async () => {
      vi.spyOn(conversationRepository, "getUserConversations").mockResolvedValue([
        {
          id: "c1",
          userId: mockUserId,
          mode: "free_conversation",
          difficulty: "intermediate",
          goalContext: null,
          status: "completed",
          startedAt: new Date(Date.now() - 3600000),
          endedAt: new Date(),
          durationSeconds: 3600,
          createdAt: new Date(),
          updatedAt: new Date(),
          turns: [
            { id: "t1", conversationId: "c1", speaker: "user", turnOrder: 1, text: "I have been interested in astronomy since childhood.", audioUrl: null, durationSeconds: 10, providerMetadata: null, createdAt: new Date(), speechSegments: [], errorOccurrences: [] },
            { id: "t2", conversationId: "c1", speaker: "user", turnOrder: 2, text: "However, I need to discuss about the budget.", audioUrl: null, durationSeconds: 10, providerMetadata: null, createdAt: new Date(), speechSegments: [], errorOccurrences: [] },
            { id: "t3", conversationId: "c1", speaker: "user", turnOrder: 3, text: "Um, we evaluated the system components carefully.", audioUrl: null, durationSeconds: 10, providerMetadata: null, createdAt: new Date(), speechSegments: [], errorOccurrences: [] },
            { id: "t4", conversationId: "c1", speaker: "user", turnOrder: 4, text: "First, we refactored the codebase. Second, we deployed it.", audioUrl: null, durationSeconds: 10, providerMetadata: null, createdAt: new Date(), speechSegments: [], errorOccurrences: [] },
            { id: "t5", conversationId: "c1", speaker: "user", turnOrder: 5, text: "Therefore, overall response performance improved markedly.", audioUrl: null, durationSeconds: 10, providerMetadata: null, createdAt: new Date(), speechSegments: [], errorOccurrences: [] },
          ],
        },
      ]);

      vi.spyOn(errorRepository, "getUserErrorHistory").mockResolvedValue([]);
      vi.spyOn(practiceRepository, "getUserAttemptHistory").mockResolvedValue([] as unknown as Awaited<ReturnType<typeof practiceRepository.getUserAttemptHistory>>);
      vi.spyOn(weaknessProfileService, "generateWeaknessProfile").mockResolvedValue({
        userId: mockUserId,
        topWeaknesses: [],
        topImprovingSkills: [],
        persistentWeaknesses: [],
        recentlyEmergingWeaknesses: [],
        relapsedWeaknesses: [],
        generatedAt: new Date(),
      });
      vi.spyOn(vocabularyService, "getUserVocabularyProfile").mockResolvedValue({
        userId: mockUserId,
        totalEncountered: 10,
        passiveCount: 5,
        activeCount: 2,
        masteredCount: 1,
        activeConversionRate: 0.3,
        dueReviewCount: 0,
        passiveVocabulary: [],
        activeVocabulary: [],
        masteredVocabulary: [],
      });

      const report = await progressAnalyticsService.generateProgressReport({
        userId: mockUserId,
        window: "30d",
      });

      expect(UserProgressReportSchema.safeParse(report).success).toBe(true);
      expect(report.scoringVersion).toBe(SCORING_VERSION);
      expect(report.dimensions["grammar"].scoringVersion).toBe(SCORING_VERSION);
      expect(report.dimensions["fluency"].scoringVersion).toBe(SCORING_VERSION);
      expect(report.rawEvidence.totalTurnsCount).toBe(5);
      expect(report.rawEvidence.totalWordsProduced).toBeGreaterThan(0);
    });
  });
});
