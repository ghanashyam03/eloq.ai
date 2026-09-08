import { describe, it, expect, beforeEach, vi } from "vitest";
import { VocabularyService } from "@/server/services/vocabulary-service";
import { vocabularyRepository } from "@/server/repositories/vocabulary-repository";
import { learningEventRepository } from "@/server/repositories/learning-event-repository";
import { VocabularyExercise, UserVocabularyState } from "@/domain/vocabulary/vocabulary.schema";

const VALID_UUID_USER = "12345678-1234-4234-8234-123456789abc";
const VALID_UUID_ITEM = "87654321-4321-4234-8234-987654321abc";
const VALID_UUID_EX = "11111111-2222-4333-8444-555555555555";

describe("Vocabulary Intelligence Service", () => {
  let service: VocabularyService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new VocabularyService();

    vi.spyOn(learningEventRepository, "logEvent").mockResolvedValue({
      id: "ev-1",
      userId: VALID_UUID_USER,
      eventType: "exercise_passed",
      entityType: "vocabulary",
      entityId: VALID_UUID_ITEM,
      payload: {},
      createdAt: new Date(),
    });
  });

  it("should extract candidates and track encounters in dictionary & user history", async () => {
    vi.spyOn(vocabularyRepository, "upsertVocabularyItem").mockResolvedValue({} as unknown as Awaited<ReturnType<typeof vocabularyRepository.upsertVocabularyItem>>);
    vi.spyOn(vocabularyRepository, "trackEncounter").mockResolvedValue({} as unknown as Awaited<ReturnType<typeof vocabularyRepository.trackEncounter>>);

    const candidates = await service.extractAndTrackVocabulary({
      userId: VALID_UUID_USER,
      text: "We must mitigate risk and articulate clear policies.",
      contextType: "production",
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(vocabularyRepository.upsertVocabularyItem).toHaveBeenCalled();
    expect(vocabularyRepository.trackEncounter).toHaveBeenCalled();
  });

  it("should process an exercise attempt, update SRS state, and record learning event", async () => {
    vi.spyOn(vocabularyRepository, "updateUserVocabularyState").mockResolvedValue({} as unknown as Awaited<ReturnType<typeof vocabularyRepository.updateUserVocabularyState>>);

    const exercise: VocabularyExercise = {
      id: VALID_UUID_EX,
      vocabularyItemId: VALID_UUID_ITEM,
      word: "mitigate",
      lemma: "mitigate",
      exerciseType: "sentence_creation",
      reviewType: "production",
      instructions: "Write a sentence with mitigate risk.",
      prompt: "Create a sentence.",
      canonicalAnswers: ["mitigate"],
      targetCollocation: "mitigate risk",
      difficulty: "B2",
    };

    const currentState: UserVocabularyState = {
      id: "uv-1",
      userId: VALID_UUID_USER,
      vocabularyItemId: VALID_UUID_ITEM,
      encounteredCount: 2,
      recognizedCount: 1,
      recalledCount: 0,
      producedCount: 1,
      correctProductionCount: 1,
      incorrectProductionCount: 0,
      naturalUsageCount: 0,
      timesMisused: 0,
      srsIntervalDays: 1,
      easeFactor: 2.5,
      consecutiveSuccesses: 1,
      mastery: 0.3,
      confidence: 0.5,
      status: "passive",
      lastSeenAt: new Date(),
      lastReviewedAt: null,
      nextReviewAt: null,
    };

    const result = await service.processExerciseAttempt({
      userId: VALID_UUID_USER,
      exercise,
      userResponse: "We took immediate steps to mitigate risk.",
      currentState,
    });

    expect(result.evaluation.isCorrect).toBe(true);
    expect(result.evaluation.rating).toBe("correct_natural");
    expect(result.updatedState.newConsecutiveSuccesses).toBe(2);
    expect(result.updatedState.nextIntervalDays).toBeGreaterThan(1);
    expect(vocabularyRepository.updateUserVocabularyState).toHaveBeenCalled();
    expect(learningEventRepository.logEvent).toHaveBeenCalled();
  });

  it("should calculate active conversion rate and build passive vs active profile", async () => {
    vi.spyOn(vocabularyRepository, "getUserVocabulary").mockResolvedValue([
      {
        vocabularyItem: { word: "mitigate", lemma: "mitigate" },
        status: "active",
        mastery: 0.7,
      },
      {
        vocabularyItem: { word: "articulate", lemma: "articulate" },
        status: "mastered",
        mastery: 0.9,
      },
      {
        vocabularyItem: { word: "ambiguous", lemma: "ambiguous" },
        status: "passive",
        mastery: 0.3,
      },
      {
        vocabularyItem: { word: "subservient", lemma: "subservient" },
        status: "encountered",
        mastery: 0.1,
      },
    ] as unknown as Awaited<ReturnType<typeof vocabularyRepository.getUserVocabulary>>);

    vi.spyOn(vocabularyRepository, "getDueReviews").mockResolvedValue([]);

    const profile = await service.getUserVocabularyProfile(VALID_UUID_USER);

    expect(profile.totalEncountered).toBe(4);
    expect(profile.passiveCount).toBe(2);
    expect(profile.activeCount).toBe(1);
    expect(profile.masteredCount).toBe(1);
    expect(profile.activeConversionRate).toBe(50.0); // 2 out of 4 active/mastered = 50%
  });
});
