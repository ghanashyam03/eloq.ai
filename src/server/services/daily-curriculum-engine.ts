import { curriculumPlanner, CurriculumPlanner } from "../curriculum/curriculum-planner";
import { curriculumExercisePhraser, CurriculumExercisePhraser, PhrasedExerciseResult } from "../curriculum/curriculum-exercise-phraser";
import { weaknessProfileService, WeaknessProfileService } from "./weakness-profile-service";
import { vocabularyService, VocabularyService } from "./vocabulary-service";
import { userRepository, UserRepository } from "../repositories/user-repository";
import { learningEventRepository } from "../repositories/learning-event-repository";
import { DailyCurriculumPlan, CurriculumActivity } from "@/domain/curriculum/daily-curriculum.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface GenerateDailyPlanOptions {
  durationMinutes?: number | undefined; // 10, 20, 30, 45, 60
}

export class DailyCurriculumEngine {
  constructor(
    private readonly planner: CurriculumPlanner = curriculumPlanner,
    private readonly phraser: CurriculumExercisePhraser = curriculumExercisePhraser,
    private readonly weaknessService: WeaknessProfileService = weaknessProfileService,
    private readonly vocabService: VocabularyService = vocabularyService,
    private readonly userRepo: UserRepository = userRepository
  ) {}

  /**
   * Synthesizes all user evidence (goals, weaknesses, SRS vocabulary, metrics) into a deterministic,
   * explainable daily curriculum plan adhering to the user's requested time budget.
   */
  async generateDailyPlan(
    userId: string,
    options?: GenerateDailyPlanOptions
  ): Promise<DailyCurriculumPlan> {
    try {
      const user = await this.userRepo.getUserProfile(userId);
      if (!user) {
        throw AppError.notFound(`User '${userId}' not found for curriculum generation`);
      }

      const durationMinutes = options?.durationMinutes ?? user.profile?.dailyTargetDurationMins ?? 20;
      const userLevel = (user.profile?.estimatedLevel as "A1" | "A2" | "B1" | "B2" | "C1" | "C2") ?? "B1";
      const userGoals = user.learningGoals.map((g) => g.description);

      // Fetch longitudinal evidence sources
      const [weaknessProfile, dueVocabulary, vocabularyProfile] = await Promise.all([
        this.weaknessService.generateWeaknessProfile(userId).catch(() => undefined),
        this.vocabService.getDueReviews(userId, 5).catch(() => []),
        this.vocabService.getUserVocabularyProfile(userId).catch(() => undefined),
      ]);

      const historicalSessionCount = (weaknessProfile?.topWeaknesses.length ?? 0) > 0 ? 5 : 0;

      const plan = this.planner.planDailyCurriculum({
        userId,
        userGoals,
        userLevel,
        availableTimeMinutes: durationMinutes,
        weaknessProfile,
        dueVocabulary: dueVocabulary.map((v) => ({ word: v.word, vocabularyItemId: v.vocabularyItemId })),
        vocabularyProfile,
        historicalSessionCount,
      });

      await learningEventRepository.logEvent({
        userId,
        eventType: "daily_curriculum_generated",
        entityType: "curriculum_plan",
        entityId: plan.planId,
        payload: {
          durationMinutes: plan.totalDurationMinutes,
          activityCount: plan.activities.length,
          remediationPercent: plan.balanceDistribution.remediationPercent,
        },
      });

      logger.info("Generated personalized daily curriculum plan", {
        userId,
        planId: plan.planId,
        totalDurationMinutes: plan.totalDurationMinutes,
      });

      return plan;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to generate daily curriculum plan", { userId }, error);
      throw AppError.internal("Error synthesizing daily curriculum plan", error);
    }
  }

  /**
   * Adapts the in-progress daily curriculum plan if user demonstrates unexpected performance in a session.
   */
  async adaptPlan(
    currentPlan: DailyCurriculumPlan,
    completedActivityId: string,
    score: number
  ): Promise<DailyCurriculumPlan> {
    const adaptedPlan = this.planner.adaptPlan(currentPlan, completedActivityId, score);

    if (adaptedPlan.adaptedCount > currentPlan.adaptedCount) {
      await learningEventRepository.logEvent({
        userId: currentPlan.userId,
        eventType: "daily_curriculum_adapted",
        entityType: "curriculum_plan",
        entityId: currentPlan.planId,
        payload: {
          completedActivityId,
          score,
          newAdaptedCount: adaptedPlan.adaptedCount,
        },
      });
    }

    return adaptedPlan;
  }

  /**
   * Phrasing function enforcing LLM role separation (HOW to phrase an exercise determined by engine).
   */
  async phraseActivity(activity: CurriculumActivity): Promise<PhrasedExerciseResult> {
    return this.phraser.phraseExercise(activity);
  }
}

export const dailyCurriculumEngine = new DailyCurriculumEngine();
