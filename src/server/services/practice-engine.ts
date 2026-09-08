import { practiceRepository, PracticeRepository } from "../repositories/practice-repository";
import { weaknessProfileService, WeaknessProfileService } from "./weakness-profile-service";
import { vocabularyService, VocabularyService } from "./vocabulary-service";
import { learningEventRepository } from "../repositories/learning-event-repository";
import { practicePrioritizer, PracticePrioritizer, CandidateTarget } from "../practice/practice-prioritizer";
import { adaptiveDifficultyManager, AdaptiveDifficultyManager } from "../practice/adaptive-difficulty";
import { practiceExerciseGenerator, PracticeExerciseGenerator } from "../practice/practice-exercise-generator";
import {
  PracticeExercise,
  PracticePlan,
  AttemptEvaluation,
} from "@/domain/practice/practice.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface PracticePlanOptions {
  durationMinutes?: number | undefined;
  focusArea?: string | undefined;
}

export class PracticeEngine {
  constructor(
    private readonly repo: PracticeRepository = practiceRepository,
    private readonly weaknessService: WeaknessProfileService = weaknessProfileService,
    private readonly vocabService: VocabularyService = vocabularyService,
    private readonly prioritizer: PracticePrioritizer = practicePrioritizer,
    private readonly difficultyManager: AdaptiveDifficultyManager = adaptiveDifficultyManager,
    private readonly generator: PracticeExerciseGenerator = practiceExerciseGenerator
  ) {}

  /**
   * Generates an evidence-backed personalized PracticePlan with transparent selection reasons.
   */
  async generatePracticePlan(
    userId: string,
    options?: PracticePlanOptions
  ): Promise<PracticePlan> {
    try {
      const duration = options?.durationMinutes ?? 15;
      const targetCount = Math.max(3, Math.round(duration / 3)); // ~3 mins per exercise

      const profile = await this.weaknessService.generateWeaknessProfile(userId);
      const dueVocab = await this.vocabService.getDueReviews(userId, 5);

      const candidateTargets: CandidateTarget[] = [];

      // Add top weaknesses as candidates
      for (const w of profile.topWeaknesses) {
        candidateTargets.push({
          id: w.id,
          type: "error",
          category: w.category,
          title: w.title,
          normalizedKey: w.normalizedKey,
          priorityScore: w.priorityScore,
          goalMatchWeight: 8.0, // High goal match for active weaknesses
          srsUrgency: 3.0,
          failureRate: 6.0,
          daysSinceLastSeen: Math.max(0, Math.floor((Date.now() - w.lastDetectedAt.getTime()) / (1000 * 60 * 60 * 24))),
          distinctSessions: w.distinctSessionCount,
          occurrenceCount: w.occurrenceCount,
        });
      }

      // Add due SRS vocabulary as candidates
      for (const v of dueVocab) {
        candidateTargets.push({
          id: v.vocabularyItemId,
          type: "vocabulary",
          category: "vocabulary",
          title: v.word,
          normalizedKey: `vocabulary:${v.word}`,
          priorityScore: 5.0,
          goalMatchWeight: 6.0,
          srsUrgency: 8.5, // High SRS urgency
          failureRate: 3.0,
          daysSinceLastSeen: 2,
          distinctSessions: 1,
          occurrenceCount: 2,
        });
      }

      // Fallback default candidate if profile is sparse
      if (candidateTargets.length === 0) {
        candidateTargets.push({
          id: crypto.randomUUID(),
          type: "grammar",
          category: "preposition",
          title: "Prepositions of Place & Time",
          normalizedKey: "grammar:preposition:in_on_at",
          priorityScore: 7.0,
          goalMatchWeight: 7.5,
          srsUrgency: 4.0,
          failureRate: 4.0,
          daysSinceLastSeen: 1,
          distinctSessions: 2,
          occurrenceCount: 3,
        });
      }

      // Prioritize candidate targets via ELV formula
      const prioritized = this.prioritizer.prioritizeCandidates(candidateTargets, profile.topWeaknesses);
      const selectedCandidates = prioritized.slice(0, targetCount);

      const exercises: PracticeExercise[] = [];
      const session = await this.repo.createPracticeSession({
        userId,
        title: `Adaptive Practice Session (${duration} mins)`,
        focusArea: options?.focusArea ?? "personalized_mix",
      });

      for (const candidate of selectedCandidates) {
        const exercise = this.generator.generateExercise({
          targetSkillType: candidate.type,
          targetCategory: candidate.category,
          title: candidate.title,
          exerciseType: candidate.type === "vocabulary" ? "fill_blank" : "correction",
          progressionStage: "controlled_production",
          difficulty: "B1",
          selectionReason: candidate.selectionReason,
          expectedLearningValue: candidate.expectedLearningValue,
        });

        await this.repo.saveExercise(exercise);
        exercises.push(exercise);
      }

      const plan: PracticePlan = {
        id: session.id,
        userId,
        targetFocusArea: options?.focusArea ?? "personalized_mix",
        durationMinutes: duration,
        exercises,
        planSummary: `Personalized practice plan generated from ${profile.topWeaknesses.length} active recurring weaknesses and ${dueVocab.length} due SRS vocabulary items.`,
        generatedAt: new Date(),
      };

      logger.info("Generated adaptive practice plan", {
        userId,
        exerciseCount: exercises.length,
        sessionId: session.id,
      });

      return plan;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to generate practice plan", { userId }, error);
      throw AppError.internal("Error assembling practice plan", error);
    }
  }

  /**
   * Selects the single next exercise with the highest expected learning value.
   */
  async selectNextExercise(userId: string): Promise<PracticeExercise> {
    const plan = await this.generatePracticePlan(userId, { durationMinutes: 5 });
    if (plan.exercises.length === 0) {
      throw AppError.notFound("No suitable practice exercise available");
    }
    return plan.exercises[0]!;
  }

  /**
   * Evaluates user attempt, calculates progression adjustment, and updates target state.
   */
  async recordAttempt(params: {
    userId: string;
    practiceSessionId: string;
    exercise: PracticeExercise;
    userResponse: string;
    consecutiveSuccesses?: number;
    consecutiveFailures?: number;
  }): Promise<AttemptEvaluation> {
    try {
      const responseText = params.userResponse.trim();
      const expected = params.exercise.expectedAnswer.trim().toLowerCase();
      const isCorrect =
        responseText.toLowerCase() === expected ||
        params.exercise.canonicalAnswers.some((ans) => responseText.toLowerCase().includes(ans.toLowerCase()));

      const score = isCorrect ? 1.0 : 0.0;
      const feedback = isCorrect
        ? `Correct! Excellent demonstration of '${params.exercise.title}'.`
        : `Incorrect. Expected answer: '${params.exercise.expectedAnswer}'.`;

      // Record attempt in database
      const attemptRecord = await this.repo.recordAttempt({
        practiceSessionId: params.practiceSessionId,
        exerciseId: params.exercise.id,
        userResponse: params.userResponse,
        isCorrect,
        score,
        feedback,
      });

      // Calculate adaptive difficulty and progression adjustment
      const adjustment = this.difficultyManager.evaluateAdjustment({
        currentStage: params.exercise.progressionStage,
        currentDifficulty: params.exercise.difficulty,
        consecutiveSuccesses: isCorrect ? (params.consecutiveSuccesses ?? 0) + 1 : 0,
        consecutiveFailures: !isCorrect ? (params.consecutiveFailures ?? 0) + 1 : 0,
      });

      // Log immutable learning event
      await learningEventRepository.logEvent({
        userId: params.userId,
        eventType: "exercise_passed",
        entityType: "practice_attempt",
        entityId: attemptRecord.id,
        payload: {
          exerciseId: params.exercise.id,
          isCorrect,
          score,
          nextStage: adjustment.nextStage,
          nextDifficulty: adjustment.nextDifficulty,
          adjustment: adjustment.adjustment,
        },
      });

      logger.info("Recorded adaptive practice attempt", {
        userId: params.userId,
        exerciseId: params.exercise.id,
        isCorrect,
        nextStage: adjustment.nextStage,
      });

      return {
        attemptId: attemptRecord.id,
        exerciseId: params.exercise.id,
        userResponse: params.userResponse,
        isCorrect,
        score,
        feedback,
        progressionResult: adjustment.nextStage,
        difficultyAdjustment: adjustment.adjustment,
        targetSkill: params.exercise.title,
        selectionReason: params.exercise.selectionReason,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to record practice attempt", { userId: params.userId }, error);
      throw AppError.internal("Error evaluating practice attempt", error);
    }
  }

  /**
   * Explicit learning state update.
   */
  async updateLearningState(params: {
    userId: string;
    targetSkill: string;
    isCorrect: boolean;
    score: number;
  }): Promise<void> {
    await learningEventRepository.logEvent({
      userId: params.userId,
      eventType: "learning_state_updated",
      entityType: "skill",
      entityId: params.targetSkill,
      payload: {
        isCorrect: params.isCorrect,
        score: params.score,
        updatedAt: new Date().toISOString(),
      },
    });
  }
}

export const practiceEngine = new PracticeEngine();
