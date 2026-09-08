import {
  ReviewType,
  NaturalnessRating,
  VocabularyStage,
  UserVocabularyState,
} from "@/domain/vocabulary/vocabulary.schema";

export interface SRSReviewResult {
  nextIntervalDays: number;
  newEaseFactor: number;
  newConsecutiveSuccesses: number;
  newMastery: number;
  newStatus: VocabularyStage;
  nextReviewAt: Date;
  encounteredCount: number;
  recognizedCount: number;
  recalledCount: number;
  producedCount: number;
  correctProductionCount: number;
  incorrectProductionCount: number;
  naturalUsageCount: number;
  timesMisused: number;
}

export class SRSScheduler {
  /**
   * Weight multipliers based on cognitive demand of review type.
   * Active production carries substantially more weight for interval expansion.
   */
  private getReviewWeight(type: ReviewType): number {
    switch (type) {
      case "recognition":
        return 1.0;
      case "recall":
        return 1.2;
      case "production":
        return 2.0;
      case "contextual_production":
        return 2.5;
    }
  }

  /**
   * Maps naturalness rating to numerical quality grade (0 to 3).
   */
  private mapRatingToGrade(rating: NaturalnessRating): number {
    switch (rating) {
      case "incorrect":
        return 0;
      case "correct_unnatural":
        return 1;
      case "correct_natural":
        return 3;
    }
  }

  /**
   * Calculates the updated SRS schedule, mastery score, and passive/active state.
   */
  calculateNextSchedule(
    currentState: UserVocabularyState,
    reviewType: ReviewType,
    rating: NaturalnessRating,
    now: Date = new Date()
  ): SRSReviewResult {
    const grade = this.mapRatingToGrade(rating);
    const weight = this.getReviewWeight(reviewType);

    const {
      srsIntervalDays,
      easeFactor,
      consecutiveSuccesses,
      encounteredCount,
      recognizedCount: origRecognized,
      recalledCount: origRecalled,
      producedCount: origProduced,
      correctProductionCount: origCorrectProd,
      incorrectProductionCount: origIncorrectProd,
      naturalUsageCount: origNatural,
      timesMisused: origMisused,
    } = currentState;

    let recognizedCount = origRecognized;
    let recalledCount = origRecalled;
    let producedCount = origProduced;
    let correctProductionCount = origCorrectProd;
    let incorrectProductionCount = origIncorrectProd;
    let naturalUsageCount = origNatural;
    let timesMisused = origMisused;

    // Update activity counters based on review type & rating
    if (reviewType === "recognition") {
      if (grade > 0) recognizedCount++;
    } else if (reviewType === "recall") {
      if (grade > 0) recalledCount++;
    } else if (reviewType === "production" || reviewType === "contextual_production") {
      producedCount++;
      if (grade === 0) {
        incorrectProductionCount++;
        timesMisused++;
      } else if (grade === 1) {
        correctProductionCount++;
      } else if (grade >= 2) {
        correctProductionCount++;
        naturalUsageCount++;
      }
    }

    // 1. Ease Factor update (bounded 1.3 to 3.5)
    // Formula: EF' = EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))
    const efDelta = 0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02);
    const newEaseFactor = parseFloat(Math.max(1.3, Math.min(3.5, easeFactor + efDelta)).toFixed(2));

    // 2. Interval calculation
    let nextIntervalDays: number;
    let newConsecutiveSuccesses: number;

    if (grade === 0) {
      newConsecutiveSuccesses = 0;
      nextIntervalDays = 1;
    } else {
      newConsecutiveSuccesses = consecutiveSuccesses + 1;
      if (newConsecutiveSuccesses === 1) {
        nextIntervalDays = 1;
      } else if (newConsecutiveSuccesses === 2) {
        nextIntervalDays = Math.max(2, Math.round(3 * weight));
      } else {
        nextIntervalDays = Math.min(
          365,
          Math.round(srsIntervalDays * newEaseFactor * weight)
        );
      }
    }

    const nextReviewAt = new Date(now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000);

    // 3. Deterministic Mastery Calculation (0.0 to 1.0)
    const weightedSuccess =
      recognizedCount * 0.5 +
      recalledCount * 0.8 +
      correctProductionCount * 2.0 +
      naturalUsageCount * 2.5;

    const weightedAttempts = Math.max(
      1,
      encounteredCount + recognizedCount + recalledCount + producedCount + timesMisused * 2
    );

    const newMastery = parseFloat(
      Math.max(0.0, Math.min(1.0, weightedSuccess / weightedAttempts)).toFixed(2)
    );

    // 4. State Machine Evaluation (encountered -> recognized -> passive -> active -> mastered)
    let newStatus: VocabularyStage = currentState.status;

    if (correctProductionCount >= 7 && naturalUsageCount >= 3 && newMastery >= 0.8 && newConsecutiveSuccesses >= 4) {
      newStatus = "mastered";
    } else if (correctProductionCount >= 3 && naturalUsageCount >= 1 && newMastery >= 0.5) {
      newStatus = "active";
    } else if (recognizedCount >= 2 || recalledCount >= 1 || newMastery >= 0.3) {
      newStatus = "passive";
    } else if (recognizedCount >= 1 || encounteredCount >= 2) {
      newStatus = "recognized";
    } else {
      newStatus = "encountered";
    }

    return {
      nextIntervalDays,
      newEaseFactor,
      newConsecutiveSuccesses,
      newMastery,
      newStatus,
      nextReviewAt,
      encounteredCount,
      recognizedCount,
      recalledCount,
      producedCount,
      correctProductionCount,
      incorrectProductionCount,
      naturalUsageCount,
      timesMisused,
    };
  }
}

export const srsScheduler = new SRSScheduler();
