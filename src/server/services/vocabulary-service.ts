import { vocabularyRepository, VocabularyRepository } from "../repositories/vocabulary-repository";
import { learningEventRepository } from "../repositories/learning-event-repository";
import { vocabularyExtractor, VocabularyExtractor } from "../vocabulary/vocabulary-extractor";
import { srsScheduler, SRSScheduler, SRSReviewResult } from "../vocabulary/srs-scheduler";
import { vocabularyExerciseGenerator, VocabularyExerciseGenerator } from "../vocabulary/vocabulary-exercise-generator";
import {
  VocabularyEntity,
  VocabularyExercise,
  UserVocabularyState,
  ExerciseEvaluationResult,
  VocabularyStage,
} from "@/domain/vocabulary/vocabulary.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface UserVocabularyProfile {
  userId: string;
  totalEncountered: number;
  passiveCount: number;
  activeCount: number;
  masteredCount: number;
  activeConversionRate: number; // percentage of encountered converted to active/mastered
  dueReviewCount: number;
  passiveVocabulary: Array<{ word: string; lemma: string; status: VocabularyStage; mastery: number }>;
  activeVocabulary: Array<{ word: string; lemma: string; status: VocabularyStage; mastery: number }>;
  masteredVocabulary: Array<{ word: string; lemma: string; status: VocabularyStage; mastery: number }>;
}

export class VocabularyService {
  constructor(
    private readonly repo: VocabularyRepository = vocabularyRepository,
    private readonly extractor: VocabularyExtractor = vocabularyExtractor,
    private readonly scheduler: SRSScheduler = srsScheduler,
    private readonly exerciseGenerator: VocabularyExerciseGenerator = vocabularyExerciseGenerator
  ) {}

  /**
   * Extracts high-value vocabulary from conversation/reading text and records encounters.
   */
  async extractAndTrackVocabulary(params: {
    userId: string;
    text: string;
    contextType: "recognition" | "production";
    userLevel?: string;
    userGoals?: string[];
    misusedWords?: string[];
  }): Promise<VocabularyEntity[]> {
    try {
      const candidates = this.extractor.extractCandidates({
        text: params.text,
        ...(params.userLevel !== undefined ? { userLevel: params.userLevel } : {}),
        ...(params.userGoals !== undefined ? { userGoals: params.userGoals } : {}),
        ...(params.misusedWords !== undefined ? { misusedWords: params.misusedWords } : {}),
      });

      for (const candidate of candidates) {
        await this.repo.upsertVocabularyItem(candidate);
        await this.repo.trackEncounter({
          userId: params.userId,
          word: candidate.word,
          contextType: params.contextType,
        });
      }

      logger.info("Extracted and tracked vocabulary candidates", {
        userId: params.userId,
        candidateCount: candidates.length,
        contextType: params.contextType,
      });

      return candidates;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to extract and track vocabulary", { userId: params.userId }, error);
      throw AppError.internal("Error extracting contextual vocabulary", error);
    }
  }

  /**
   * Generates active retrieval exercises for words due for SRS review.
   */
  async getDueReviews(userId: string, limit = 5): Promise<VocabularyExercise[]> {
    try {
      const dueRecords = await this.repo.getDueReviews(userId, limit);
      const exercises: VocabularyExercise[] = [];

      for (const record of dueRecords) {
        const item = record.vocabularyItem;
        const vocabEntity: VocabularyEntity = {
          id: item.id,
          word: item.word,
          lemma: item.lemma ?? item.word,
          partOfSpeech: item.partOfSpeech,
          definition: item.definition,
          pronunciation: item.pronunciation ?? undefined,
          ipa: item.ipa ?? undefined,
          register: item.register,
          difficulty: item.difficulty,
          collocations: (item.collocations as string[]) ?? [],
          synonyms: (item.synonyms as string[]) ?? [],
          antonyms: (item.antonyms as string[]) ?? [],
          exampleSentences: (item.exampleSentences as string[]) ?? [],
          isModelGenerated: item.isModelGenerated,
        };

        // If user already produced it, escalate exercise to active production or creation
        const reviewType = record.timesSuccessfullyProduced > 0 ? "production" : "recognition";
        const exercise = this.exerciseGenerator.generateExercise(vocabEntity, reviewType);
        exercises.push(exercise);
      }

      return exercises;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to get due vocabulary reviews", { userId }, error);
      throw AppError.database("Error loading due vocabulary exercises", error);
    }
  }

  /**
   * Processes a user's attempt on a vocabulary exercise, updating SRS schedule and mastery deterministically.
   */
  async processExerciseAttempt(params: {
    userId: string;
    exercise: VocabularyExercise;
    userResponse: string;
    currentState: UserVocabularyState;
  }): Promise<{ evaluation: ExerciseEvaluationResult; updatedState: SRSReviewResult }> {
    try {
      // 1. Evaluate response naturalness & correctness
      const evaluation = this.exerciseGenerator.evaluateResponse(
        params.exercise,
        params.userResponse
      );

      // 2. Calculate next SRS schedule deterministically
      const updatedState = this.scheduler.calculateNextSchedule(
        params.currentState,
        params.exercise.reviewType,
        evaluation.rating
      );

      // 3. Persist updated SRS state in database
      await this.repo.updateUserVocabularyState(
        params.userId,
        params.exercise.vocabularyItemId,
        {
          encounteredCount: updatedState.encounteredCount,
          recognizedCount: updatedState.recognizedCount,
          recalledCount: updatedState.recalledCount,
          producedCount: updatedState.producedCount,
          correctProductionCount: updatedState.correctProductionCount,
          incorrectProductionCount: updatedState.incorrectProductionCount,
          naturalUsageCount: updatedState.naturalUsageCount,
          timesMisused: updatedState.timesMisused,
          srsIntervalDays: updatedState.nextIntervalDays,
          easeFactor: updatedState.newEaseFactor,
          consecutiveSuccesses: updatedState.newConsecutiveSuccesses,
          mastery: updatedState.newMastery,
          status: updatedState.newStatus,
          lastReviewedAt: new Date(),
          nextReviewAt: updatedState.nextReviewAt,
        }
      );

      // 4. Log immutable learning event
      await learningEventRepository.logEvent({
        userId: params.userId,
        eventType: "exercise_passed",
        entityType: "vocabulary",
        entityId: params.exercise.vocabularyItemId,
        payload: {
          exerciseId: params.exercise.id,
          rating: evaluation.rating,
          score: evaluation.score,
          newStatus: updatedState.newStatus,
          nextIntervalDays: updatedState.nextIntervalDays,
        },
      });

      logger.info("Processed vocabulary exercise attempt", {
        userId: params.userId,
        word: params.exercise.word,
        rating: evaluation.rating,
        newStatus: updatedState.newStatus,
        nextIntervalDays: updatedState.nextIntervalDays,
      });

      return { evaluation, updatedState };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to process exercise attempt", { userId: params.userId }, error);
      throw AppError.internal("Error processing vocabulary attempt", error);
    }
  }

  /**
   * Generates a comprehensive passive vs. active user vocabulary profile.
   */
  async getUserVocabularyProfile(userId: string): Promise<UserVocabularyProfile> {
    try {
      const items = await this.repo.getUserVocabulary(userId);
      const dueReviews = await this.repo.getDueReviews(userId);

      const passiveList: UserVocabularyProfile["passiveVocabulary"] = [];
      const activeList: UserVocabularyProfile["activeVocabulary"] = [];
      const masteredList: UserVocabularyProfile["masteredVocabulary"] = [];

      for (const item of items) {
        const entry = {
          word: item.vocabularyItem.word,
          lemma: item.vocabularyItem.lemma ?? item.vocabularyItem.word,
          status: item.status as VocabularyStage,
          mastery: item.mastery,
        };

        if (item.status === "mastered") {
          masteredList.push(entry);
        } else if (item.status === "active") {
          activeList.push(entry);
        } else {
          passiveList.push(entry);
        }
      }

      const totalEncountered = items.length;
      const passiveCount = passiveList.length;
      const activeCount = activeList.length;
      const masteredCount = masteredList.length;

      const activeConversionRate =
        totalEncountered > 0
          ? parseFloat((((activeCount + masteredCount) / totalEncountered) * 100).toFixed(1))
          : 0.0;

      return {
        userId,
        totalEncountered,
        passiveCount,
        activeCount,
        masteredCount,
        activeConversionRate,
        dueReviewCount: dueReviews.length,
        passiveVocabulary: passiveList,
        activeVocabulary: activeList,
        masteredVocabulary: masteredList,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to get user vocabulary profile", { userId }, error);
      throw AppError.database("Error building user vocabulary profile", error);
    }
  }
}

export const vocabularyService = new VocabularyService();
