import { db } from "../db/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface DataDeletionSummary {
  userId: string;
  conversationsDeleted: number;
  turnsDeleted: number;
  vocabularyItemsDeleted: number;
  practiceSessionsDeleted: number;
  learningEventsDeleted: number;
  userProfileDeleted: boolean;
}

export class UserDataDeletionService {
  /**
   * Complete user data purge: Permanently deletes all conversations, transcripts, vocabulary states,
   * practice sessions, learning events, error occurrences, and user profile records with full relational cleanup.
   */
  async purgeCompleteUserData(userId: string): Promise<DataDeletionSummary> {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw AppError.notFound(`User '${userId}' not found for data deletion`);
      }

      // Count associated records before deletion for audit reporting
      const [convCount, vocabCount, sessionCount, eventCount] = await Promise.all([
        db.conversation.count({ where: { userId } }),
        db.userVocabularyItem.count({ where: { userId } }),
        db.practiceSession.count({ where: { userId } }),
        db.learningEvent.count({ where: { userId } }),
      ]);

      const turnCount = await db.conversationTurn.count({
        where: { conversation: { userId } },
      });

      // Execute cascading purge on User record
      await db.user.delete({
        where: { id: userId },
      });

      const summary: DataDeletionSummary = {
        userId,
        conversationsDeleted: convCount,
        turnsDeleted: turnCount,
        vocabularyItemsDeleted: vocabCount,
        practiceSessionsDeleted: sessionCount,
        learningEventsDeleted: eventCount,
        userProfileDeleted: true,
      };

      logger.info("Executed complete relational user data purge", summary as unknown as Record<string, unknown>);

      return summary;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to purge user data", { userId }, error);
      throw AppError.database("Error executing relational user data deletion", error);
    }
  }

  /**
   * Deletes a specific conversation session and all its associated turns, speech segments, and error occurrences.
   */
  async deleteConversation(userId: string, conversationId: string): Promise<{ conversationId: string; turnsDeleted: number }> {
    try {
      const conv = await db.conversation.findFirst({
        where: { id: conversationId, userId },
        include: { _count: { select: { turns: true } } },
      });

      if (!conv) {
        throw AppError.notFound(`Conversation '${conversationId}' not found for user '${userId}'`);
      }

      const turnCount = conv._count.turns;

      await db.conversation.delete({
        where: { id: conversationId },
      });

      logger.info("Deleted conversation session and child records", { userId, conversationId, turnCount });

      return { conversationId, turnsDeleted: turnCount };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to delete conversation", { userId, conversationId }, error);
      throw AppError.database("Error deleting conversation session", error);
    }
  }
}

export const userDataDeletionService = new UserDataDeletionService();
