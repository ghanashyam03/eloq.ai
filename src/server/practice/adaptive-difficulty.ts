import { ProgressionStage } from "@/domain/practice/practice.schema";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const STAGE_ORDER: ProgressionStage[] = [
  "recognition",
  "controlled_production",
  "guided_production",
  "spontaneous_production",
  "real_conversation",
];

export interface ProgressionAdjustmentResult {
  nextStage: ProgressionStage;
  nextDifficulty: string;
  adjustment: "increased" | "unchanged" | "reduced";
  reason: string;
}

export class AdaptiveDifficultyManager {
  /**
   * Evaluates performance history and determines next progression stage and CEFR difficulty.
   */
  evaluateAdjustment(params: {
    currentStage: ProgressionStage;
    currentDifficulty: string;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
  }): ProgressionAdjustmentResult {
    const stageIndex = STAGE_ORDER.indexOf(params.currentStage);
    const difficultyIndex = Math.max(0, CEFR_LEVELS.indexOf(params.currentDifficulty.toUpperCase()));

    // 1. Check escalation (2 consecutive successes)
    if (params.consecutiveSuccesses >= 2) {
      const nextStageIndex = Math.min(STAGE_ORDER.length - 1, stageIndex + 1);
      const nextDifficultyIndex = Math.min(CEFR_LEVELS.length - 1, difficultyIndex + 1);

      const nextStage = STAGE_ORDER[nextStageIndex]!;
      const nextDifficulty = CEFR_LEVELS[nextDifficultyIndex]!;

      return {
        nextStage,
        nextDifficulty,
        adjustment: "increased",
        reason: `Consecutive successes (${params.consecutiveSuccesses}) demonstrated mastery. Advanced progression stage to '${nextStage}' and difficulty to '${nextDifficulty}'.`,
      };
    }

    // 2. Check regression (2 consecutive failures)
    if (params.consecutiveFailures >= 2) {
      const nextStageIndex = Math.max(0, stageIndex - 1);
      const nextDifficultyIndex = Math.max(0, difficultyIndex - 1);

      const nextStage = STAGE_ORDER[nextStageIndex]!;
      const nextDifficulty = CEFR_LEVELS[nextDifficultyIndex]!;

      return {
        nextStage,
        nextDifficulty,
        adjustment: "reduced",
        reason: `Recent failures (${params.consecutiveFailures}) indicated difficulty mismatch. Regressed stage to '${nextStage}' and difficulty to '${nextDifficulty}' for scaffolding.`,
      };
    }

    // 3. Maintain current levels
    return {
      nextStage: params.currentStage,
      nextDifficulty: params.currentDifficulty,
      adjustment: "unchanged",
      reason: `Performance stable. Maintained current stage '${params.currentStage}' and difficulty '${params.currentDifficulty}'.`,
    };
  }
}

export const adaptiveDifficultyManager = new AdaptiveDifficultyManager();
