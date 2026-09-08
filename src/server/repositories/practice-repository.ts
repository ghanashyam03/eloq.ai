import { db } from "../db/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import { PracticeExercise } from "@/domain/practice/practice.schema";
import { Prisma } from "@prisma/client";

export interface CreatePracticeSessionDTO {
  userId: string;
  title: string;
  focusArea: string;
  conversationId?: string | undefined;
}

export interface RecordAttemptDTO {
  practiceSessionId: string;
  exerciseId: string;
  userResponse: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
  turnId?: string | undefined;
}

export class PracticeRepository {
  /**
   * Starts a new practice session.
   */
  async createPracticeSession(dto: CreatePracticeSessionDTO) {
    try {
      return await db.practiceSession.create({
        data: {
          id: crypto.randomUUID(),
          userId: dto.userId,
          title: dto.title,
          focusArea: dto.focusArea,
          ...(dto.conversationId ? { conversationId: dto.conversationId } : {}),
        },
      });
    } catch (error) {
      logger.error("Failed to create practice session", { userId: dto.userId }, error);
      throw AppError.database("Error creating practice session record", error);
    }
  }

  /**
   * Persists a generated practice exercise.
   */
  async saveExercise(exercise: PracticeExercise) {
    try {
      return await db.practiceExercise.upsert({
        where: { id: exercise.id },
        update: {
          title: exercise.title,
          exerciseType: exercise.exerciseType,
          progressionStage: exercise.progressionStage,
          targetSkillType: exercise.targetSkillType,
          targetCategory: exercise.targetCategory,
          instructions: exercise.instructions,
          promptText: exercise.promptText,
          expectedAnswer: exercise.expectedAnswer,
          selectionReason: exercise.selectionReason,
          learningObjective: exercise.learningObjective,
          options: (exercise.options as unknown as Prisma.InputJsonValue) ?? null,
          difficulty: exercise.difficulty,
          grammarSkillId: exercise.grammarSkillId ?? null,
          vocabularyItemId: exercise.vocabularyItemId ?? null,
          errorDefinitionId: exercise.errorDefinitionId ?? null,
        },
        create: {
          id: exercise.id,
          title: exercise.title,
          exerciseType: exercise.exerciseType,
          progressionStage: exercise.progressionStage,
          targetSkillType: exercise.targetSkillType,
          targetCategory: exercise.targetCategory,
          instructions: exercise.instructions,
          promptText: exercise.promptText,
          expectedAnswer: exercise.expectedAnswer,
          selectionReason: exercise.selectionReason,
          learningObjective: exercise.learningObjective,
          options: (exercise.options as unknown as Prisma.InputJsonValue) ?? null,
          difficulty: exercise.difficulty,
          grammarSkillId: exercise.grammarSkillId ?? null,
          vocabularyItemId: exercise.vocabularyItemId ?? null,
          errorDefinitionId: exercise.errorDefinitionId ?? null,
        },
      });
    } catch (error) {
      logger.error("Failed to save practice exercise", { id: exercise.id }, error);
      throw AppError.database("Error saving practice exercise to database", error);
    }
  }

  /**
   * Records a user's practice attempt.
   */
  async recordAttempt(dto: RecordAttemptDTO) {
    try {
      const attempt = await db.practiceAttempt.create({
        data: {
          id: crypto.randomUUID(),
          practiceSessionId: dto.practiceSessionId,
          exerciseId: dto.exerciseId,
          userResponse: dto.userResponse,
          isCorrect: dto.isCorrect,
          score: dto.score,
          feedback: dto.feedback,
          ...(dto.turnId ? { turnId: dto.turnId } : {}),
        },
      });

      logger.info("Recorded practice attempt", {
        practiceSessionId: dto.practiceSessionId,
        exerciseId: dto.exerciseId,
        isCorrect: dto.isCorrect,
      });

      return attempt;
    } catch (error) {
      logger.error("Failed to record practice attempt", { dto }, error);
      throw AppError.database("Error saving practice attempt record", error);
    }
  }

  /**
   * Fetches historical practice attempts for a user.
   */
  async getUserAttemptHistory(userId: string, limit = 20) {
    try {
      return await db.practiceAttempt.findMany({
        where: {
          practiceSession: {
            userId,
          },
        },
        include: {
          exercise: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (error) {
      logger.error("Failed to fetch user attempt history", { userId }, error);
      throw AppError.database("Error loading practice attempt history", error);
    }
  }
}

export const practiceRepository = new PracticeRepository();
