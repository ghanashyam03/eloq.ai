import { describe, it, expect, beforeEach, vi } from "vitest";
import { CurriculumPlanner } from "@/server/curriculum/curriculum-planner";
import { DailyCurriculumEngine } from "@/server/services/daily-curriculum-engine";
import { CurriculumExercisePhraser } from "@/server/curriculum/curriculum-exercise-phraser";
import { ModelRouter } from "@/server/providers/llm/router/model-router";
import { MockLLMProvider } from "@/server/providers/llm/implementations/mock.provider";
import { userRepository } from "@/server/repositories/user-repository";
import { learningEventRepository } from "@/server/repositories/learning-event-repository";

describe("Personalized Daily Curriculum Engine", () => {
  let planner: CurriculumPlanner;
  let engine: DailyCurriculumEngine;
  let mockRouter: ModelRouter;

  const mockUserId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.restoreAllMocks();
    planner = new CurriculumPlanner();

    mockRouter = new ModelRouter();
    const mockProvider = new MockLLMProvider({
      cannedResponse: JSON.stringify({
        title: "Mastering Prepositions of Place",
        instructions: "Complete the sentences by filling in the correct preposition.",
        promptText: "She arrived ___ the airport just in time.",
        contextScenario: "Travel and airport navigation",
      }),
    });
    mockRouter.registerProvider("huggingface", mockProvider);

    const phraser = new CurriculumExercisePhraser(mockRouter);
    engine = new DailyCurriculumEngine(planner, phraser);

    // Mock DB / Service defaults
    vi.spyOn(userRepository, "getUserProfile").mockResolvedValue({
      id: mockUserId,
      email: "test@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Curriculum User",
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
        {
          id: "g-1",
          userId: mockUserId,
          category: "grammar",
          description: "Master prepositions",
          priority: 1,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof userRepository.getUserProfile>>);

    vi.spyOn(learningEventRepository, "logEvent").mockResolvedValue({
      id: "evt-curriculum-1",
      userId: mockUserId,
      eventType: "daily_curriculum_generated",
      entityType: "curriculum_plan",
      entityId: "plan-1",
      payload: {},
      createdAt: new Date(),
    });
  });

  describe("1. Scenario Test: Severe Preposition Weakness", () => {
    it("should schedule high-priority targeted remediation for severe preposition weakness with explicit machine-readable reason", () => {
      const plan = planner.planDailyCurriculum({
        userId: mockUserId,
        availableTimeMinutes: 20,
        userLevel: "B2",
        historicalSessionCount: 5,
        weaknessProfile: {
          userId: mockUserId,
          generatedAt: new Date(),
          topWeaknesses: [
            {
              id: "123e4567-e89b-12d3-a456-426614174001",
              title: "Preposition Misuse (in vs on)",
              description: "Misuse of prepositions",
              category: "grammar",
              subcategory: "prepositions",
              normalizedKey: "grammar:preposition:in_on",
              priorityScore: 8.5,
              occurrenceCount: 12,
              distinctSessionCount: 4,
              firstDetectedAt: new Date(),
              lastDetectedAt: new Date(),
              averageSeverity: 4.0,
              averageConfidence: 0.9,
              masteryEstimate: 0.2,
              trend: "worsening",
              status: "active",
              contextDistribution: { speaking: 4, writing: 4, conversation: 4, exercise: 0 },
              sampleExamples: [],
            },
          ],
          topImprovingSkills: [],
          persistentWeaknesses: [],
          recentlyEmergingWeaknesses: [],
          relapsedWeaknesses: [],
        },
      });

      const remediationActivity = plan.activities.find((a) => a.activityType === "targeted_remediation");
      expect(remediationActivity).toBeDefined();
      expect(remediationActivity?.targetSkill).toBe("Preposition Misuse (in vs on)");
      expect(remediationActivity?.reason.primaryFactor).toBe("high_recurrence_weakness");
      expect(remediationActivity?.reason.weaknessRecurrence).toBeGreaterThanOrEqual(10);
      expect(remediationActivity?.reason.explanationText).toContain("High recurrence");
    });
  });

  describe("2. Scenario Test: Mastered Vocabulary with Low Active Production", () => {
    it("should schedule active production exercises when passive vocabulary exists but active conversion is low", () => {
      const plan = planner.planDailyCurriculum({
        userId: mockUserId,
        availableTimeMinutes: 20,
        userLevel: "B2",
        historicalSessionCount: 5,
        vocabularyProfile: {
          userId: mockUserId,
          totalEncountered: 50,
          passiveCount: 30,
          activeCount: 5,
          masteredCount: 2,
          activeConversionRate: 0.14,
          dueReviewCount: 0,
          passiveVocabulary: [
            { word: "substantive", lemma: "substantive", status: "recognized", mastery: 40 },
          ],
          activeVocabulary: [],
          masteredVocabulary: [],
        },
      });

      const productionActivity = plan.activities.find((a) => a.activityType === "writing_production");
      expect(productionActivity).toBeDefined();
      expect(productionActivity?.reason.primaryFactor).toBe("active_production_gap");
      expect(productionActivity?.targetSkill).toContain("Active Production Practice (substantive)");
      expect(productionActivity?.reason.explanationText).toContain("recognized passively but lacks active production evidence");
    });
  });

  describe("3. Scenario Test: Strong Grammar but Poor Fluency / High Hesitation", () => {
    it("should prioritize spontaneous speaking when fluency metrics show high hesitation fillers", () => {
      const plan = planner.planDailyCurriculum({
        userId: mockUserId,
        availableTimeMinutes: 30,
        userLevel: "B2",
        historicalSessionCount: 10,
        speakingMetrics: {
          fillerRatePerMin: 5.2, // High hesitation fillers
          averageWpm: 90,
          pauseCount: 12,
          fluencyScore: 55,
        },
      });

      const spontaneousActivity = plan.activities.find((a) => a.activityType === "spontaneous_speaking");
      expect(spontaneousActivity).toBeDefined();
      expect(spontaneousActivity?.reason.primaryFactor).toBe("fluency_spontaneous_need");
      expect(spontaneousActivity?.reason.explanationText).toContain("High grammar accuracy paired with low speaking fluency metrics");
    });
  });

  describe("4. Scenario Test: Sparse Evidence / Cold Start", () => {
    it("should generate a conservative diagnostic baseline plan for users with little or no historical evidence", () => {
      const plan = planner.planDailyCurriculum({
        userId: mockUserId,
        availableTimeMinutes: 20,
        userLevel: "B1",
        historicalSessionCount: 0, // Cold start
      });

      expect(plan.activities.length).toBeGreaterThanOrEqual(2);
      expect(plan.activities.every((a) => a.reason.primaryFactor === "diagnostic_baseline")).toBe(true);
      expect(plan.activities[0]?.targetSkill).toContain("Baseline");
    });
  });

  describe("5. Time Budget & Balance Enforcement", () => {
    it("should strictly enforce user-selected duration budgets (10, 20, 30, 45, 60 minutes)", () => {
      const budgets = [10, 20, 30, 45, 60];

      for (const budget of budgets) {
        const plan = planner.planDailyCurriculum({
          userId: mockUserId,
          availableTimeMinutes: budget,
          historicalSessionCount: 3,
        });

        const totalPlannedDuration = plan.activities.reduce((sum, a) => sum + a.durationMinutes, 0);
        expect(totalPlannedDuration).toBe(budget);
        expect(plan.totalDurationMinutes).toBe(budget);
      }
    });

    it("should guarantee at least one spontaneous speaking activity in every daily plan", () => {
      const plan = planner.planDailyCurriculum({
        userId: mockUserId,
        availableTimeMinutes: 15,
        historicalSessionCount: 5,
      });

      const hasSpontaneousSpeaking = plan.activities.some((a) => a.activityType === "spontaneous_speaking");
      expect(hasSpontaneousSpeaking).toBe(true);
    });
  });

  describe("6. In-Session Adaptation", () => {
    it("should adapt subsequent activities in daily plan upon unexpected in-session activity failure", () => {
      const initialPlan = planner.planDailyCurriculum({
        userId: mockUserId,
        availableTimeMinutes: 30,
        userLevel: "B2",
        historicalSessionCount: 5,
        weaknessProfile: {
          userId: mockUserId,
          generatedAt: new Date(),
          topWeaknesses: [
            {
              id: "123e4567-e89b-12d3-a456-426614174002",
              title: "Present Perfect Tense",
              description: "Tense consistency error",
              category: "grammar",
              subcategory: "verb_tenses",
              normalizedKey: "grammar:verb_tenses:present_perfect",
              priorityScore: 7.0,
              occurrenceCount: 5,
              distinctSessionCount: 2,
              firstDetectedAt: new Date(),
              lastDetectedAt: new Date(),
              averageSeverity: 3.5,
              averageConfidence: 0.85,
              masteryEstimate: 0.3,
              trend: "stable",
              status: "active",
              contextDistribution: { speaking: 2, writing: 3, conversation: 0, exercise: 0 },
              sampleExamples: [],
            },
          ],
          topImprovingSkills: [],
          persistentWeaknesses: [],
          recentlyEmergingWeaknesses: [],
          relapsedWeaknesses: [],
        },
      });

      const firstActivityId = initialPlan.activities[0]!.id;

      // Simulate failure (score = 0.2) on first activity
      const adaptedPlan = planner.adaptPlan(initialPlan, firstActivityId, 0.2);

      expect(adaptedPlan.adaptedCount).toBe(1);
      expect(adaptedPlan.activities[1]?.targetSkill).toContain("Reinforcement");
      expect(adaptedPlan.activities[1]?.reason.explanationText).toContain("In-session adaptation triggered due to score 20%");
    });
  });

  describe("7. LLM Role Separation & Activity Phrasing", () => {
    it("should enforce LLM role separation by keeping target skill and difficulty fixed while LLM generates phrasing", async () => {
      const initialPlan = planner.planDailyCurriculum({
        userId: mockUserId,
        availableTimeMinutes: 20,
        userLevel: "B2",
        historicalSessionCount: 5,
      });

      const activity = initialPlan.activities[0]!;
      const phrased = await engine.phraseActivity(activity);

      expect(phrased.activityId).toBe(activity.id);
      expect(phrased.targetSkill).toBe(activity.targetSkill);
      expect(phrased.title).toBeDefined();
      expect(phrased.instructions).toBeDefined();
    });
  });
});
