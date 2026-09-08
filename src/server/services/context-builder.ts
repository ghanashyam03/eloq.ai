import { userRepository } from "../repositories/user-repository";
import { conversationRepository } from "../repositories/conversation-repository";
import { errorRepository } from "../repositories/error-repository";
import { vocabularyRepository } from "../repositories/vocabulary-repository";
import { PromptContextPayload, ConversationOptions } from "@/domain/conversation/conversation-mode.types";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export class ContextBuilder {
  /**
   * Selectively retrieves relevant context from database repositories
   * and constructs a bounded prompt context payload.
   */
  async buildContext(
    userId: string,
    conversationId: string,
    options: ConversationOptions,
    maxTurnWindow: number = 10
  ): Promise<PromptContextPayload> {
    try {
      const [userRecord, conversationRecord, errorHistory, vocabList] = await Promise.all([
        userRepository.getUserProfile(userId),
        conversationRepository.getConversationHistory(conversationId),
        errorRepository.getUserErrorHistory(userId),
        vocabularyRepository.getUserVocabulary(userId, "active"),
      ]);

      if (!conversationRecord) {
        throw AppError.notFound(`Conversation session '${conversationId}' not found`);
      }

      // 1. Extract Bounded Turn Window (last N turns)
      const allTurns = conversationRecord.turns ?? [];
      const recentTurns = allTurns
        .slice(-maxTurnWindow)
        .map((turn) => ({
          speaker: turn.speaker,
          text: turn.text,
        }));

      // 2. Selectively Extract Learning Goals (top 3)
      const learningGoals = (userRecord?.learningGoals ?? [])
        .map((g) => g.description)
        .slice(0, 3);

      // 3. Selectively Extract Top 3 Recurring Weakness Categories
      const weaknessMap = new Map<string, number>();
      for (const err of errorHistory) {
        const key = `${err.errorDefinition.name} (${err.category})`;
        weaknessMap.set(key, (weaknessMap.get(key) ?? 0) + 1);
      }

      const recurringWeaknesses = Array.from(weaknessMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => `${name} [${count}x]`);

      // 4. Selectively Extract Target Vocabulary Items (top 5 active)
      const targetVocabulary = vocabList
        .map((v) => v.vocabularyItem.word)
        .slice(0, 5);

      const payload: PromptContextPayload = {
        mode: options.mode,
        difficulty: options.difficulty,
        correctionMode: options.correctionMode,
        ...(options.topicHint ? { topic: options.topicHint } : {}),
        ...(options.scenarioId ? { scenarioId: options.scenarioId } : {}),
        userProfile: {
          targetVariety: userRecord?.profile?.targetVariety ?? "en-US",
          estimatedLevel: userRecord?.profile?.estimatedLevel ?? "B1",
        },
        learningGoals,
        recurringWeaknesses,
        targetVocabulary,
        recentTurns,
      };

      logger.info("Assembled bounded conversation context", {
        userId,
        conversationId,
        turnCount: recentTurns.length,
        goalCount: learningGoals.length,
        weaknessCount: recurringWeaknesses.length,
      });

      return payload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to build conversation context", { userId, conversationId }, error);
      throw AppError.database("Error assembling context for conversation engine", error);
    }
  }
}

export const contextBuilder = new ContextBuilder();
