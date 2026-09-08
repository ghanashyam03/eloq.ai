import {
  GrammarSkillMastery,
  EvidenceLevel,
  RelapseState,
  SkillTrend,
} from "@/domain/grammar/grammar-learning.schema";

export const EVIDENCE_WEIGHTS: Record<EvidenceLevel, number> = {
  recognition: 0.2,
  controlled_production: 0.5,
  guided_production: 0.7,
  spontaneous_production: 1.0,
};

export class GrammarMasteryEngine {
  /**
   * Deterministically calculates updated mastery state after a practice/conversed attempt.
   */
  public updateMasteryState(
    current: GrammarSkillMastery,
    attempt: {
      isCorrect: boolean;
      evidenceLevel: EvidenceLevel;
      timestamp?: Date;
    }
  ): GrammarSkillMastery {
    const now = attempt.timestamp ?? new Date();
    const weight = EVIDENCE_WEIGHTS[attempt.evidenceLevel];

    const evidenceCount = current.evidenceCount + 1;
    let successfulControlledAttempts = current.successfulControlledAttempts;
    let successfulOpenAttempts = current.successfulOpenAttempts;
    let failures = current.failures;
    let relapseState: RelapseState = current.relapseState;

    if (attempt.isCorrect) {
      if (attempt.evidenceLevel === "recognition" || attempt.evidenceLevel === "controlled_production") {
        successfulControlledAttempts++;
      } else {
        successfulOpenAttempts++;
      }
    } else {
      failures++;
    }

    // 1. Calculate Weighted Evidence Score
    const delta = attempt.isCorrect ? weight * 0.15 : -weight * 0.25;
    const newWeightedScore = Math.max(0, current.weightedEvidenceScore + (attempt.isCorrect ? weight : 0));

    // 2. Compute Raw Mastery Score (capped based on evidence tier)
    // Controlled-only attempts cap mastery at 0.65; spontaneous production required for higher scores
    let rawMastery = current.masteryScore + delta;

    if (successfulOpenAttempts === 0 && rawMastery > 0.65) {
      rawMastery = 0.65; // Cap controlled-only mastery
    }

    const masteryScore = Math.min(1.0, Math.max(0.0, Math.round(rawMastery * 100) / 100));

    // 3. Compute Confidence (increases with evidence volume and consistency)
    const confidence = Math.min(1.0, Math.round((evidenceCount / (evidenceCount + 5)) * 100) / 100);

    // 4. Relapse & State Machine Transitions
    if (relapseState === "not_started") {
      relapseState = "learning";
    }

    if (attempt.isCorrect) {
      if (masteryScore >= 0.85 && successfulOpenAttempts >= 2) {
        relapseState = "mastered";
      } else if (relapseState === "relapse") {
        relapseState = "active_remediation";
      } else if (relapseState === "active_remediation" && masteryScore >= 0.8) {
        relapseState = "mastered";
      }
    } else {
      // Failure logic
      if (relapseState === "mastered" && attempt.evidenceLevel === "spontaneous_production") {
        relapseState = "relapse"; // Spontaneous error triggers relapse!
      }
    }

    // 5. Spaced Review (SRS) Interval Calculation
    let srsIntervalDays = current.srsIntervalDays;
    if (attempt.isCorrect) {
      const multiplier = relapseState === "mastered" ? 2.2 : 1.5;
      srsIntervalDays = Math.min(90, Math.round(srsIntervalDays * multiplier * 10) / 10);
    } else {
      // Failure shortens interval for active remediation
      srsIntervalDays = Math.max(1.0, Math.round(srsIntervalDays * 0.4 * 10) / 10);
    }

    const nextReviewAt = new Date(now.getTime() + srsIntervalDays * 24 * 60 * 60 * 1000);

    // 6. Skill Trend Calculation
    let trend: SkillTrend = current.trend;
    if (attempt.isCorrect && delta > 0) {
      trend = "improving";
    } else if (!attempt.isCorrect) {
      trend = "declining";
    } else {
      trend = "stable";
    }

    // 7. Priority Score (higher priority for relapsed or low mastery skills)
    let currentPriority = 5.0;
    if (relapseState === "relapse") {
      currentPriority = 9.5; // Highest priority
    } else if (relapseState === "active_remediation") {
      currentPriority = 8.0;
    } else {
      currentPriority = Math.max(1.0, Math.round((1.0 - masteryScore) * 10 * 10) / 10);
    }

    return {
      skillId: current.skillId,
      userId: current.userId,
      masteryScore,
      confidence,
      evidenceCount,
      weightedEvidenceScore: Math.round(newWeightedScore * 100) / 100,
      successfulControlledAttempts,
      successfulOpenAttempts,
      failures,
      lastPracticeAt: now,
      lastSuccessAt: attempt.isCorrect ? now : current.lastSuccessAt,
      currentPriority,
      trend,
      relapseState,
      srsIntervalDays,
      nextReviewAt,
    };
  }

  /**
   * Initializes a default mastery record for a user and skill.
   */
  public createInitialMastery(userId: string, skillId: string): GrammarSkillMastery {
    const now = new Date();
    return {
      skillId,
      userId,
      masteryScore: 0.0,
      confidence: 0.0,
      evidenceCount: 0,
      weightedEvidenceScore: 0,
      successfulControlledAttempts: 0,
      successfulOpenAttempts: 0,
      failures: 0,
      lastPracticeAt: null,
      lastSuccessAt: null,
      currentPriority: 7.0,
      trend: "stable",
      relapseState: "not_started",
      srsIntervalDays: 1.0,
      nextReviewAt: now,
    };
  }
}

export const grammarMasteryEngine = new GrammarMasteryEngine();
