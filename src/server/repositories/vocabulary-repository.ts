import { db } from "../db/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";
import {
  VocabularyEntity,
  UserVocabularyState,
} from "@/domain/vocabulary/vocabulary.schema";
import { Prisma } from "@prisma/client";

export interface TrackVocabularyEncounterDTO {
  userId: string;
  word: string;
  contextType: "recognition" | "production" | "misuse";
}

export class VocabularyRepository {
  /**
   * Upserts a canonical dictionary vocabulary item.
   */
  async upsertVocabularyItem(item: VocabularyEntity) {
    try {
      return await db.vocabularyItem.upsert({
        where: { word: item.word.toLowerCase() },
        update: {
          lemma: item.lemma,
          definition: item.definition,
          partOfSpeech: item.partOfSpeech,
          pronunciation: item.pronunciation ?? null,
          ipa: item.ipa ?? null,
          register: item.register,
          difficulty: item.difficulty,
          collocations: item.collocations as unknown as Prisma.InputJsonValue,
          synonyms: item.synonyms as unknown as Prisma.InputJsonValue,
          antonyms: item.antonyms as unknown as Prisma.InputJsonValue,
          exampleSentences: item.exampleSentences as unknown as Prisma.InputJsonValue,
          isModelGenerated: item.isModelGenerated,
        },
        create: {
          id: item.id ?? crypto.randomUUID(),
          word: item.word.toLowerCase(),
          lemma: item.lemma,
          definition: item.definition,
          partOfSpeech: item.partOfSpeech,
          pronunciation: item.pronunciation ?? null,
          ipa: item.ipa ?? null,
          register: item.register,
          difficulty: item.difficulty,
          collocations: item.collocations as unknown as Prisma.InputJsonValue,
          synonyms: item.synonyms as unknown as Prisma.InputJsonValue,
          antonyms: item.antonyms as unknown as Prisma.InputJsonValue,
          exampleSentences: item.exampleSentences as unknown as Prisma.InputJsonValue,
          isModelGenerated: item.isModelGenerated,
        },
      });
    } catch (error) {
      logger.error("Failed to upsert vocabulary item", { word: item.word }, error);
      throw AppError.database("Error saving vocabulary item to dictionary", error);
    }
  }

  /**
   * Tracks a vocabulary encounter in user history and updates counters.
   */
  async trackEncounter(dto: TrackVocabularyEncounterDTO) {
    try {
      const normalizedWord = dto.word.toLowerCase();
      let vocabItem = await db.vocabularyItem.findUnique({
        where: { word: normalizedWord },
      });

      if (!vocabItem) {
        vocabItem = await db.vocabularyItem.create({
          data: {
            id: crypto.randomUUID(),
            word: normalizedWord,
            lemma: normalizedWord,
            definition: `Encountered term '${normalizedWord}'`,
            partOfSpeech: "noun",
            difficulty: "intermediate",
            isModelGenerated: true,
          },
        });
      }

      return await db.$transaction(async (tx) => {
        const existing = await tx.userVocabularyItem.findUnique({
          where: {
            userId_vocabularyItemId: {
              userId: dto.userId,
              vocabularyItemId: vocabItem.id,
            },
          },
        });

        const now = new Date();
        const isRecog = dto.contextType === "recognition";
        const isProd = dto.contextType === "production";
        const isMisuse = dto.contextType === "misuse";

        const timesEncountered = (existing?.timesEncountered ?? 0) + 1;
        const timesRecognized = (existing?.timesCorrectlyRecognized ?? 0) + (isRecog ? 1 : 0);
        const timesProduced = (existing?.timesSuccessfullyProduced ?? 0) + (isProd ? 1 : 0);
        const timesMisused = (existing?.timesMisused ?? 0) + (isMisuse ? 1 : 0);

        let status = "encountered";
        if (timesProduced >= 3 && timesMisused <= 1) {
          status = "active";
        } else if (timesRecognized >= 2) {
          status = "passive";
        } else if (timesRecognized >= 1) {
          status = "recognized";
        }

        const totalValid = timesRecognized + timesProduced;
        const mastery = Math.min(1.0, Math.max(0.0, (totalValid - timesMisused * 2) / Math.max(1, timesEncountered)));

        const userVocab = await tx.userVocabularyItem.upsert({
          where: {
            userId_vocabularyItemId: {
              userId: dto.userId,
              vocabularyItemId: vocabItem.id,
            },
          },
          update: {
            timesEncountered,
            timesCorrectlyRecognized: timesRecognized,
            timesSuccessfullyProduced: timesProduced,
            timesMisused,
            mastery,
            status,
            lastSeenAt: now,
          },
          create: {
            id: crypto.randomUUID(),
            userId: dto.userId,
            vocabularyItemId: vocabItem.id,
            timesEncountered: 1,
            timesCorrectlyRecognized: isRecog ? 1 : 0,
            timesSuccessfullyProduced: isProd ? 1 : 0,
            timesMisused: isMisuse ? 1 : 0,
            mastery: isMisuse ? 0.0 : 0.5,
            status: isProd ? "active" : isRecog ? "passive" : "encountered",
            lastSeenAt: now,
          },
        });

        logger.info("Tracked vocabulary encounter", {
          userId: dto.userId,
          word: dto.word,
          status,
          contextType: dto.contextType,
        });

        return userVocab;
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to track vocabulary encounter", { userId: dto.userId, word: dto.word }, error);
      throw AppError.database("Error updating user vocabulary status", error);
    }
  }

  /**
   * Updates user vocabulary SRS state and counters after a review attempt.
   */
  async updateUserVocabularyState(
    userId: string,
    vocabularyItemId: string,
    state: Partial<UserVocabularyState>
  ) {
    try {
      return await db.userVocabularyItem.update({
        where: {
          userId_vocabularyItemId: {
            userId,
            vocabularyItemId,
          },
        },
        data: {
          ...(state.encounteredCount !== undefined ? { timesEncountered: state.encounteredCount } : {}),
          ...(state.recognizedCount !== undefined ? { timesCorrectlyRecognized: state.recognizedCount } : {}),
          ...(state.producedCount !== undefined ? { timesSuccessfullyProduced: state.producedCount } : {}),
          ...(state.timesMisused !== undefined ? { timesMisused: state.timesMisused } : {}),
          ...(state.recalledCount !== undefined ? { recalledCount: state.recalledCount } : {}),
          ...(state.naturalUsageCount !== undefined ? { naturalUsageCount: state.naturalUsageCount } : {}),
          ...(state.correctProductionCount !== undefined ? { correctProductionCount: state.correctProductionCount } : {}),
          ...(state.incorrectProductionCount !== undefined ? { incorrectProductionCount: state.incorrectProductionCount } : {}),
          ...(state.srsIntervalDays !== undefined ? { srsIntervalDays: state.srsIntervalDays } : {}),
          ...(state.easeFactor !== undefined ? { easeFactor: state.easeFactor } : {}),
          ...(state.consecutiveSuccesses !== undefined ? { consecutiveSuccesses: state.consecutiveSuccesses } : {}),
          ...(state.mastery !== undefined ? { mastery: state.mastery } : {}),
          ...(state.confidence !== undefined ? { confidence: state.confidence } : {}),
          ...(state.status !== undefined ? { status: state.status } : {}),
          ...(state.lastReviewedAt !== undefined ? { lastReviewedAt: state.lastReviewedAt } : {}),
          ...(state.nextReviewAt !== undefined ? { nextReviewAt: state.nextReviewAt } : {}),
        },
      });
    } catch (error) {
      logger.error("Failed to update user vocabulary state", { userId, vocabularyItemId }, error);
      throw AppError.database("Error persisting user vocabulary state update", error);
    }
  }

  /**
   * Fetches vocabulary items due for SRS review for a specific user.
   */
  async getDueReviews(userId: string, limit = 10) {
    try {
      const now = new Date();
      return await db.userVocabularyItem.findMany({
        where: {
          userId,
          OR: [{ nextReviewAt: { lte: now } }, { nextReviewAt: null }],
        },
        include: {
          vocabularyItem: true,
        },
        orderBy: [{ nextReviewAt: "asc" }, { updatedAt: "asc" }],
        take: limit,
      });
    } catch (error) {
      logger.error("Failed to fetch due SRS reviews", { userId }, error);
      throw AppError.database("Error querying due vocabulary reviews", error);
    }
  }

  /**
   * Fetches complete user vocabulary items optionally filtered by stage status.
   */
  async getUserVocabulary(userId: string, status?: string) {
    try {
      return await db.userVocabularyItem.findMany({
        where: {
          userId,
          ...(status ? { status } : {}),
        },
        include: {
          vocabularyItem: true,
        },
        orderBy: { lastSeenAt: "desc" },
      });
    } catch (error) {
      logger.warn("Database unreachable for getUserVocabulary; returning empty in-memory list", { userId });
      return [];
    }
  }
}

export const vocabularyRepository = new VocabularyRepository();
