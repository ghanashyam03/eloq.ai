import {
  DailyCurriculumPlan,
  DailyCurriculumPlanSchema,
  CurriculumActivity,
  TargetCategory,
} from "@/domain/curriculum/daily-curriculum.schema";
import { UserWeaknessProfile } from "@/domain/learning/weakness-engine.schema";
import { UserVocabularyProfile } from "../services/vocabulary-service";
import { logger } from "@/lib/logger/logger";

export interface CurriculumEvidenceInput {
  userId: string;
  userGoals?: string[] | undefined;
  userLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | undefined;
  availableTimeMinutes?: number | undefined;
  weaknessProfile?: UserWeaknessProfile | undefined;
  dueVocabulary?: Array<{ word: string; vocabularyItemId?: string | undefined }> | undefined;
  vocabularyProfile?: UserVocabularyProfile | undefined;
  speakingMetrics?: {
    fillerRatePerMin?: number | undefined;
    averageWpm?: number | undefined;
    pauseCount?: number | undefined;
    fluencyScore?: number | undefined;
  } | undefined;
  pronunciationState?: {
    overallScore?: number | undefined;
    weakPhonemes?: string[] | undefined;
  } | undefined;
  grammarSkillsMastery?: Array<{ skillId: string; title: string; mastery: number; priority: number }> | undefined;
  historicalSessionCount?: number | undefined;
}

export class CurriculumPlanner {
  /**
   * Deterministically plans a daily curriculum by synthesizing all input evidence into
   * an ordered set of explainable activities adhering to time budget and balance rules.
   */
  public planDailyCurriculum(input: CurriculumEvidenceInput): DailyCurriculumPlan {
    const userId = input.userId;
    const duration = input.availableTimeMinutes ?? 20;
    const level = input.userLevel ?? "B1";
    const dateStr = new Date().toISOString().split("T")[0]!;

    const hasSparseEvidence =
      (!input.historicalSessionCount || input.historicalSessionCount <= 1) &&
      !input.weaknessProfile?.topWeaknesses.length &&
      !input.dueVocabulary?.length &&
      !input.vocabularyProfile?.passiveVocabulary.length &&
      !input.speakingMetrics;

    let activities: CurriculumActivity[] = [];

    if (hasSparseEvidence) {
      activities = this.generateColdStartActivities(userId, duration, level);
    } else {
      activities = this.generateEvidenceBasedActivities(input, duration, level);
    }

    // Calculate actual time distribution
    let remediationTime = 0;
    let maintenanceTime = 0;
    let newLearningTime = 0;
    let spontaneousTime = 0;

    activities.forEach((act) => {
      switch (act.activityType) {
        case "targeted_remediation":
          remediationTime += act.durationMinutes;
          break;
        case "retrieval_review":
          maintenanceTime += act.durationMinutes;
          break;
        case "new_skill_learning":
          newLearningTime += act.durationMinutes;
          break;
        case "spontaneous_speaking":
          spontaneousTime += act.durationMinutes;
          break;
        default:
          remediationTime += act.durationMinutes / 2;
          maintenanceTime += act.durationMinutes / 2;
          break;
      }
    });

    const totalCalculated = Math.max(
      remediationTime + maintenanceTime + newLearningTime + spontaneousTime,
      1
    );

    const plan: DailyCurriculumPlan = {
      planId: crypto.randomUUID(),
      userId,
      date: dateStr,
      totalDurationMinutes: duration,
      balanceDistribution: {
        remediationPercent: Math.round((remediationTime / totalCalculated) * 100),
        maintenancePercent: Math.round((maintenanceTime / totalCalculated) * 100),
        newLearningPercent: Math.round((newLearningTime / totalCalculated) * 100),
        spontaneousPercent: Math.round((spontaneousTime / totalCalculated) * 100),
      },
      activities,
      generatedAt: new Date(),
      adaptedCount: 0,
    };

    logger.info("Deterministic daily curriculum plan generated", {
      userId,
      planId: plan.planId,
      durationMinutes: duration,
      activityCount: activities.length,
    });

    return DailyCurriculumPlanSchema.parse(plan);
  }

  /**
   * Generates conservative diagnostic activities for a cold-start user with sparse evidence.
   */
  private generateColdStartActivities(
    userId: string,
    totalMinutes: number,
    level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
  ): CurriculumActivity[] {
    const activities: CurriculumActivity[] = [];

    // Slot 1: Spontaneous Introductory Speaking
    const slot1Duration = Math.max(3, Math.round(totalMinutes * 0.35));
    activities.push({
      id: crypto.randomUUID(),
      order: 1,
      activityType: "spontaneous_speaking",
      targetSkill: "Spontaneous Speaking Baseline",
      targetCategory: "fluency",
      objectives: ["Establish baseline spoken fluency and vocabulary usage"],
      durationMinutes: slot1Duration,
      difficulty: level,
      reason: {
        primaryFactor: "diagnostic_baseline",
        explanationText: "Sparse historic evidence. Initiating spontaneous speaking baseline assessment.",
      },
      exerciseConfig: { promptType: "self_introduction_and_goals" },
    });

    // Slot 2: Vocabulary & Grammar Retrieval
    const slot2Duration = Math.max(3, Math.round(totalMinutes * 0.35));
    activities.push({
      id: crypto.randomUUID(),
      order: 2,
      activityType: "retrieval_review",
      targetSkill: "Core Vocabulary & Structure Retrieval",
      targetCategory: "grammar",
      objectives: ["Review core sentence patterns and high-frequency vocabulary"],
      durationMinutes: slot2Duration,
      difficulty: level,
      reason: {
        primaryFactor: "diagnostic_baseline",
        explanationText: "Diagnostic baseline review to gauge grammar and vocabulary recognition.",
      },
      exerciseConfig: { focus: "foundational_grammar" },
    });

    // Slot 3: Guided Spontaneous Scenario (Remaining duration)
    const remainingDuration = Math.max(2, totalMinutes - (slot1Duration + slot2Duration));
    activities.push({
      id: crypto.randomUUID(),
      order: 3,
      activityType: "spontaneous_speaking",
      targetSkill: "Interactive Conversational Scenario",
      targetCategory: "fluency",
      objectives: ["Practice conversational turn-taking under guided prompt"],
      durationMinutes: remainingDuration,
      difficulty: level,
      reason: {
        primaryFactor: "diagnostic_baseline",
        explanationText: "Completing daily plan budget with guided conversational interaction.",
      },
      exerciseConfig: { scenario: "casual_chat" },
    });

    return activities;
  }

  /**
   * Synthesizes rich historical evidence (weaknesses, SRS, fluency metrics, goals) into balanced activities.
   */
  private generateEvidenceBasedActivities(
    input: CurriculumEvidenceInput,
    totalMinutes: number,
    level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
  ): CurriculumActivity[] {
    const activities: CurriculumActivity[] = [];
    const topWeakness = input.weaknessProfile?.topWeaknesses[0];
    const dueVocab = input.dueVocabulary ?? [];
    const vocabProfile = input.vocabularyProfile;
    const speakingMetrics = input.speakingMetrics;

    // Time allocation distribution based on total budget
    const maintenanceMinutes = Math.max(2, Math.round(totalMinutes * 0.2));
    const spontaneousMinutes = Math.max(3, Math.round(totalMinutes * 0.25));
    let remediationMinutes = Math.max(3, Math.round(totalMinutes * 0.35));
    let productionMinutes = Math.max(2, totalMinutes - (maintenanceMinutes + spontaneousMinutes + remediationMinutes));

    if (productionMinutes < 2) {
      remediationMinutes = Math.max(3, remediationMinutes - 1);
      productionMinutes = 2;
    }

    let order = 1;

    // 1. Maintenance / Retrieval Review (SRS & Decay)
    if (dueVocab.length > 0 || maintenanceMinutes > 0) {
      const itemNames = dueVocab.slice(0, 3).map((v) => v.word).join(", ");
      activities.push({
        id: crypto.randomUUID(),
        order: order++,
        activityType: "retrieval_review",
        targetSkill: dueVocab.length > 0 ? `SRS Vocabulary Review (${itemNames})` : "General Memory Maintenance",
        targetCategory: "vocabulary",
        objectives: ["Retrieve decay-prone vocabulary before memory lapse occurs"],
        durationMinutes: maintenanceMinutes,
        difficulty: level,
        reason: {
          primaryFactor: "srs_decay_review",
          decayScore: Math.min(10, Math.round(dueVocab.length * 2)),
          explanationText: `Memory retention decay model indicates ${dueVocab.length} vocabulary items are due for retrieval.`,
        },
        exerciseConfig: { dueItems: dueVocab.map((v) => v.word) },
      });
    }

    // 2. Targeted Remediation (Recurrent Weakness)
    if (topWeakness) {
      activities.push({
        id: crypto.randomUUID(),
        order: order++,
        activityType: "targeted_remediation",
        targetSkill: topWeakness.title,
        targetCategory: (topWeakness.category as TargetCategory) ?? "grammar",
        objectives: [`Eliminate recurring error pattern in ${topWeakness.title}`],
        durationMinutes: remediationMinutes,
        difficulty: level,
        reason: {
          primaryFactor: "high_recurrence_weakness",
          weaknessRecurrence: Math.min(10, topWeakness.occurrenceCount),
          severityScore: Math.min(10, Math.round(topWeakness.priorityScore)),
          explanationText: `High recurrence (${topWeakness.occurrenceCount} occurrences across ${topWeakness.distinctSessionCount} sessions). Targeted remediation scheduled.`,
        },
        exerciseConfig: { normalizedKey: topWeakness.normalizedKey },
      });
    }

    // 3. Active Vocabulary Production Gap OR Writing Production
    const passiveWords = vocabProfile?.passiveVocabulary ?? [];
    if (passiveWords.length > 0 || vocabProfile?.activeConversionRate !== undefined) {
      const targetWord = passiveWords[0]?.word ?? "domain_vocabulary";
      activities.push({
        id: crypto.randomUUID(),
        order: order++,
        activityType: "writing_production",
        targetSkill: `Active Production Practice (${targetWord})`,
        targetCategory: "vocabulary",
        objectives: [`Produce target vocabulary '${targetWord}' in original context`],
        durationMinutes: productionMinutes,
        difficulty: level,
        reason: {
          primaryFactor: "active_production_gap",
          goalRelevance: 8.0,
          explanationText: `Vocabulary '${targetWord}' is recognized passively but lacks active production evidence.`,
        },
        exerciseConfig: { targetWords: [targetWord] },
      });
    }

    // 4. Spontaneous Speaking (Guaranteed in every daily plan)
    const fillerRate = speakingMetrics?.fillerRatePerMin ?? 0;
    const isFluencyGap = fillerRate > 3 || (speakingMetrics?.fluencyScore && speakingMetrics.fluencyScore < 70);

    activities.push({
      id: crypto.randomUUID(),
      order: order++,
      activityType: "spontaneous_speaking",
      targetSkill: isFluencyGap ? "Fluency & Uninhibited Spontaneous Speech" : "Scenario Simulation Speaking",
      targetCategory: "fluency",
      objectives: ["Deliver uninhibited spontaneous speech in real-time dialogue"],
      durationMinutes: spontaneousMinutes,
      difficulty: level,
      reason: {
        primaryFactor: isFluencyGap ? "fluency_spontaneous_need" : "goal_alignment",
        explanationText: isFluencyGap
          ? "High grammar accuracy paired with low speaking fluency metrics. Prioritizing uninhibited spontaneous speaking."
          : "Mandatory daily spontaneous speaking component to build real-world communication confidence.",
      },
      exerciseConfig: { mode: "free_conversation" },
    });

    const currentSum = activities.reduce((s, a) => s + a.durationMinutes, 0);
    const diff = totalMinutes - currentSum;
    if (diff !== 0 && activities.length > 0) {
      const last = activities[activities.length - 1]!;
      last.durationMinutes = Math.max(1, last.durationMinutes + diff);
    }

    return activities;
  }

  /**
   * Adapts an in-progress daily plan cleanly if user demonstrates unexpected performance during a session.
   */
  public adaptPlan(
    currentPlan: DailyCurriculumPlan,
    completedActivityId: string,
    score: number
  ): DailyCurriculumPlan {
    const activityIndex = currentPlan.activities.findIndex((a) => a.id === completedActivityId);
    if (activityIndex === -1) {
      return currentPlan;
    }

    // If score is acceptable (>= 0.6), no mid-session adaptation required
    if (score >= 0.6) {
      return currentPlan;
    }

    const updatedActivities = [...currentPlan.activities];
    const failedActivity = updatedActivities[activityIndex]!;

    // Find the immediate next activity to adapt
    const nextActivity = updatedActivities[activityIndex + 1];
    if (nextActivity) {
      // Modify next activity to incorporate reinforcement for the failed concept
      updatedActivities[activityIndex + 1] = {
        ...nextActivity,
        targetSkill: `Reinforcement: ${failedActivity.targetSkill}`,
        objectives: [
          `Reinforce ${failedActivity.targetSkill} following unexpected performance in preceding activity`,
          ...nextActivity.objectives,
        ],
        reason: {
          primaryFactor: "high_recurrence_weakness",
          explanationText: `In-session adaptation triggered due to score ${Math.round(score * 100)}% on activity '${failedActivity.targetSkill}'.`,
        },
        exerciseConfig: {
          ...nextActivity.exerciseConfig,
          reinforceTarget: failedActivity.targetSkill,
        },
      };
    }

    const adaptedPlan: DailyCurriculumPlan = {
      ...currentPlan,
      activities: updatedActivities,
      adaptedCount: currentPlan.adaptedCount + 1,
    };

    logger.info("Adapted daily curriculum plan in-session", {
      planId: currentPlan.planId,
      failedActivityId: completedActivityId,
      score,
      adaptedCount: adaptedPlan.adaptedCount,
    });

    return DailyCurriculumPlanSchema.parse(adaptedPlan);
  }
}

export const curriculumPlanner = new CurriculumPlanner();
