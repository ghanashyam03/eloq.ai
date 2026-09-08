import { describe, it, expect } from "vitest";
import { srsScheduler } from "@/server/vocabulary/srs-scheduler";
import { UserVocabularyState } from "@/domain/vocabulary/vocabulary.schema";

const VALID_UUID_1 = "12345678-1234-4234-8234-123456789abc";
const VALID_UUID_2 = "87654321-4321-4234-8234-987654321abc";
const VALID_UUID_3 = "11111111-2222-4333-8444-555555555555";

describe("Spaced Repetition Scheduler (SRS)", () => {
  const baseState: UserVocabularyState = {
    id: VALID_UUID_1,
    userId: VALID_UUID_2,
    vocabularyItemId: VALID_UUID_3,
    encounteredCount: 1,
    recognizedCount: 0,
    recalledCount: 0,
    producedCount: 0,
    correctProductionCount: 0,
    incorrectProductionCount: 0,
    naturalUsageCount: 0,
    timesMisused: 0,
    srsIntervalDays: 1,
    easeFactor: 2.5,
    consecutiveSuccesses: 0,
    mastery: 0.0,
    confidence: 0.5,
    status: "encountered",
    lastSeenAt: new Date(),
    lastReviewedAt: null,
    nextReviewAt: null,
  };

  it("should reset interval to 1 day and consecutive successes to 0 on incorrect review (grade 0)", () => {
    const state: UserVocabularyState = {
      ...baseState,
      srsIntervalDays: 10,
      consecutiveSuccesses: 3,
      easeFactor: 2.5,
    };

    const result = srsScheduler.calculateNextSchedule(state, "production", "incorrect");

    expect(result.nextIntervalDays).toBe(1);
    expect(result.newConsecutiveSuccesses).toBe(0);
    expect(result.newEaseFactor).toBeLessThan(2.5);
    expect(result.incorrectProductionCount).toBe(1);
    expect(result.timesMisused).toBe(1);
  });

  it("should increase consecutive successes and scale interval on correct natural review", () => {
    const state: UserVocabularyState = {
      ...baseState,
      srsIntervalDays: 1,
      consecutiveSuccesses: 1,
      easeFactor: 2.5,
    };

    const result = srsScheduler.calculateNextSchedule(state, "production", "correct_natural");

    expect(result.newConsecutiveSuccesses).toBe(2);
    expect(result.nextIntervalDays).toBeGreaterThanOrEqual(5); // 3 * reviewWeight (2.0) = 6
    expect(result.naturalUsageCount).toBe(1);
    expect(result.correctProductionCount).toBe(1);
  });

  it("should give higher interval weight to contextual production than passive recognition", () => {
    const state: UserVocabularyState = {
      ...baseState,
      srsIntervalDays: 6,
      consecutiveSuccesses: 2,
      easeFactor: 2.5,
    };

    const recogResult = srsScheduler.calculateNextSchedule(state, "recognition", "correct_natural");
    const prodResult = srsScheduler.calculateNextSchedule(state, "contextual_production", "correct_natural");

    expect(prodResult.nextIntervalDays).toBeGreaterThan(recogResult.nextIntervalDays);
  });

  it("should transition state from passive to active when production & natural usage thresholds are met", () => {
    const state: UserVocabularyState = {
      ...baseState,
      encounteredCount: 5,
      recognizedCount: 3,
      producedCount: 2,
      correctProductionCount: 2,
      naturalUsageCount: 0,
      mastery: 0.4,
      status: "passive",
    };

    const result = srsScheduler.calculateNextSchedule(state, "contextual_production", "correct_natural");

    expect(result.producedCount).toBe(3);
    expect(result.correctProductionCount).toBe(3);
    expect(result.naturalUsageCount).toBe(1);
    expect(result.newStatus).toBe("active");
  });

  it("should transition state to mastered when high production, natural usage, and consecutive successes are met", () => {
    const state: UserVocabularyState = {
      ...baseState,
      encounteredCount: 10,
      recognizedCount: 5,
      recalledCount: 3,
      producedCount: 6,
      correctProductionCount: 6,
      naturalUsageCount: 3,
      consecutiveSuccesses: 3,
      mastery: 0.85,
      status: "active",
    };

    const result = srsScheduler.calculateNextSchedule(state, "contextual_production", "correct_natural");

    expect(result.correctProductionCount).toBe(7);
    expect(result.naturalUsageCount).toBe(4);
    expect(result.newConsecutiveSuccesses).toBe(4);
    expect(result.newStatus).toBe("mastered");
  });
});
