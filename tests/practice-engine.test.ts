import { describe, it, expect, beforeEach, vi } from "vitest";
import { PracticeEngine } from "@/server/services/practice-engine";
import { practiceRepository } from "@/server/repositories/practice-repository";
import { weaknessProfileService } from "@/server/services/weakness-profile-service";
import { vocabularyService } from "@/server/services/vocabulary-service";
import { learningEventRepository } from "@/server/repositories/learning-event-repository";
import { PracticeExercise } from "@/domain/practice/practice.schema";

const VALID_UUID_USER = "12345678-1234-4234-8234-123456789abc";
const VALID_UUID_SESS = "87654321-4321-4234-8234-987654321abc";
const VALID_UUID_EX = "11111111-2222-4333-8444-555555555555";

describe("Practice Engine", () => {
  let engine: PracticeEngine;

  beforeEach(() => {
    vi.restoreAllMocks();
    engine = new PracticeEngine();

    vi.spyOn(weaknessProfileService, "generateWeaknessProfile").mockResolvedValue({
      userId: VALID_UUID_USER,
      topWeaknesses: [
        {
          id: "w-1",
          normalizedKey: "grammar:preposition:interested_in",
          title: "PREPOSITION: interested in",
          description: "Preposition issue",
          category: "grammar",
          subcategory: "preposition",
          occurrenceCount: 4,
          distinctSessionCount: 2,
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date(),
          averageSeverity: 3.5,
          averageConfidence: 0.9,
          priorityScore: 8.0,
          masteryEstimate: 0.2,
          trend: "worsening",
          status: "active",
          contextDistribution: { speaking: 4, writing: 0, conversation: 4, exercise: 0 },
          sampleExamples: [],
        },
      ],
      topImprovingSkills: [],
      persistentWeaknesses: [],
      recentlyEmergingWeaknesses: [],
      relapsedWeaknesses: [],
      generatedAt: new Date(),
    });

    vi.spyOn(vocabularyService, "getDueReviews").mockResolvedValue([]);

    vi.spyOn(practiceRepository, "createPracticeSession").mockResolvedValue({
      id: VALID_UUID_SESS,
      userId: VALID_UUID_USER,
      conversationId: null,
      title: "Practice Session",
      focusArea: "personalized_mix",
      status: "in_progress",
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
    });

    vi.spyOn(practiceRepository, "saveExercise").mockResolvedValue({} as unknown as Awaited<ReturnType<typeof practiceRepository.saveExercise>>);

    vi.spyOn(learningEventRepository, "logEvent").mockResolvedValue({
      id: "ev-1",
      userId: VALID_UUID_USER,
      eventType: "exercise_passed",
      entityType: "practice_attempt",
      entityId: "att-1",
      payload: {},
      createdAt: new Date(),
    });
  });

  it("should generate a personalized practice plan backed by weakness evidence and transparent selection reasons", async () => {
    const plan = await engine.generatePracticePlan(VALID_UUID_USER, { durationMinutes: 15 });

    expect(plan.userId).toBe(VALID_UUID_USER);
    expect(plan.exercises.length).toBeGreaterThan(0);
    const firstEx = plan.exercises[0]!;
    expect(firstEx.selectionReason).toContain("high-priority recurring weakness");
  });

  it("should select the single next exercise with highest Expected Learning Value", async () => {
    const exercise = await engine.selectNextExercise(VALID_UUID_USER);

    expect(exercise).toBeDefined();
    expect(exercise.selectionReason).toBeDefined();
    expect(exercise.expectedLearningValue).toBeGreaterThan(0);
  });

  it("should record attempt, evaluate response correctness, update adaptive progression, and log learning event", async () => {
    vi.spyOn(practiceRepository, "recordAttempt").mockResolvedValue({
      id: "att-1",
      practiceSessionId: VALID_UUID_SESS,
      exerciseId: VALID_UUID_EX,
      turnId: null,
      userResponse: "I am interested in physics.",
      isCorrect: true,
      score: 1.0,
      feedback: "Correct!",
      createdAt: new Date(),
    });

    const exercise: PracticeExercise = {
      id: VALID_UUID_EX,
      title: "Correct Preposition",
      exerciseType: "correction",
      progressionStage: "controlled_production",
      targetSkillType: "error",
      targetCategory: "preposition",
      instructions: "Fix sentence",
      promptText: "I am interested on physics.",
      expectedAnswer: "I am interested in physics.",
      canonicalAnswers: ["I am interested in physics."],
      difficulty: "B1",
      selectionReason: "Selected because preposition is top weakness.",
      learningObjective: "Master prepositions",
      expectedLearningValue: 8.5,
    };

    const evalResult = await engine.recordAttempt({
      userId: VALID_UUID_USER,
      practiceSessionId: VALID_UUID_SESS,
      exercise,
      userResponse: "I am interested in physics.",
      consecutiveSuccesses: 1,
    });

    expect(evalResult.isCorrect).toBe(true);
    expect(evalResult.difficultyAdjustment).toBe("increased"); // 2nd consecutive success
    expect(evalResult.progressionResult).toBe("guided_production");
    expect(practiceRepository.recordAttempt).toHaveBeenCalled();
    expect(learningEventRepository.logEvent).toHaveBeenCalled();
  });
});
