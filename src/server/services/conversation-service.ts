import { conversationRepository } from "../repositories/conversation-repository";
import { learningEventRepository } from "../repositories/learning-event-repository";
import { contextBuilder, ContextBuilder } from "./context-builder";
import { modelRouter, ModelRouter } from "../providers/llm/router/model-router";
import { buildConversationPromptV1 } from "../prompts/conversation.v1";
import { ConversationOptions, ConversationOptionsSchema } from "@/domain/conversation/conversation-mode.types";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface ConversationTurnResult {
  turnId: string;
  conversationId: string;
  speaker: "user" | "assistant";
  text: string;
  turnOrder: number;
  createdAt: Date;
}

export interface StreamChunkResult {
  delta: string;
  isDone: boolean;
}

export class ConversationService {
  constructor(
    private readonly router: ModelRouter = modelRouter,
    private readonly ctxBuilder: ContextBuilder = contextBuilder
  ) {}

  /**
   * Initializes a new conversation session for a user.
   */
  async startConversation(userId: string, rawOptions?: Partial<ConversationOptions>) {
    const options = ConversationOptionsSchema.parse(rawOptions ?? {});

    const conversation = await conversationRepository.createConversation({
      userId,
      mode: options.mode,
      difficulty: options.difficulty,
      ...(options.topicHint ? { goalContext: options.topicHint } : {}),
    });

    await learningEventRepository.logEvent({
      userId,
      eventType: "conversation_started",
      entityType: "conversation",
      entityId: conversation.id,
      payload: { mode: options.mode, difficulty: options.difficulty },
    });

    logger.info("Started new conversation session", {
      userId,
      conversationId: conversation.id,
      mode: options.mode,
    });

    return conversation;
  }

  /**
   * Processes a user's conversational turn and persists it cleanly to the database.
   */
  async processUserTurn(
    conversationId: string,
    userText: string,
    audioDurationSeconds?: number
  ): Promise<ConversationTurnResult> {
    if (!userText || userText.trim().length === 0) {
      throw AppError.validation("User conversation message cannot be empty");
    }

    const conversation = await conversationRepository.getConversationHistory(conversationId);
    if (!conversation) {
      throw AppError.notFound(`Conversation session '${conversationId}' not found`);
    }

    const { turn } = await conversationRepository.addTurn({
      conversationId,
      speaker: "user",
      text: userText.trim(),
      ...(audioDurationSeconds !== undefined ? { durationSeconds: audioDurationSeconds } : {}),
    });

    await learningEventRepository.logEvent({
      userId: conversation.userId,
      eventType: "user_turn_processed",
      entityType: "turn",
      entityId: turn.id,
      payload: { conversationId, textLength: turn.text.length },
    });

    return {
      turnId: turn.id,
      conversationId,
      speaker: "user",
      text: turn.text,
      turnOrder: turn.turnOrder,
      createdAt: turn.createdAt,
    };
  }

  /**
   * Generates a assistant response turn by building context, invoking the model router,
   * validating output format, and persisting the turn to the database.
   */
  async generateAssistantTurn(
    conversationId: string,
    rawOptions?: Partial<ConversationOptions>
  ): Promise<ConversationTurnResult> {
    const options = ConversationOptionsSchema.parse(rawOptions ?? {});

    const conversation = await conversationRepository.getConversationHistory(conversationId);
    if (!conversation) {
      throw AppError.notFound(`Conversation session '${conversationId}' not found`);
    }

    // 1. Build Bounded Context Payload
    const context = await this.ctxBuilder.buildContext(conversation.userId, conversationId, options);

    // 2. Build Versioned Prompt Messages (conversation.v1)
    const messages = buildConversationPromptV1(context);

    // 3. Invoke Model Router
    let responseText = "";
    try {
      const response = await this.router.generateCompletion(messages, {
        taskType: "conversation",
        temperature: 0.7,
      });
      responseText = response.content.trim();
    } catch (error) {
      logger.error("Failed to generate assistant turn from model router", { conversationId }, error);
      throw error; // Prevents persisting corrupt/failed turn state
    }

    if (!responseText || responseText.length === 0) {
      throw AppError.externalProvider("router", "Received empty response content from AI provider");
    }

    // Clean any accidental leakage of untrusted input tags if model repeated them
    const cleanedText = responseText.replace(/<\/?UNTRUSTED_USER_INPUT>/gi, "").trim();

    // 4. Persist Valid Assistant Turn
    const { turn } = await conversationRepository.addTurn({
      conversationId,
      speaker: "assistant",
      text: cleanedText,
    });

    return {
      turnId: turn.id,
      conversationId,
      speaker: "assistant",
      text: turn.text,
      turnOrder: turn.turnOrder,
      createdAt: turn.createdAt,
    };
  }

  /**
   * Generates a streaming assistant response turn. Yields deltas to the caller,
   * and persists the complete assistant turn to the database upon completion.
   */
  async *generateAssistantStream(
    conversationId: string,
    rawOptions?: Partial<ConversationOptions>
  ): AsyncIterable<StreamChunkResult> {
    const options = ConversationOptionsSchema.parse(rawOptions ?? {});

    const conversation = await conversationRepository.getConversationHistory(conversationId);
    if (!conversation) {
      throw AppError.notFound(`Conversation session '${conversationId}' not found`);
    }

    const context = await this.ctxBuilder.buildContext(conversation.userId, conversationId, options);
    const messages = buildConversationPromptV1(context);

    const provider = this.router.getProvider("huggingface");
    let accumulatedText = "";

    try {
      const stream = provider.generateStream(messages, {
        taskType: "conversation",
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        accumulatedText += chunk.delta;
        yield { delta: chunk.delta, isDone: chunk.isDone };
      }
    } catch (error) {
      logger.error("Streaming assistant turn failed", { conversationId }, error);
      throw error; // Aborts stream without persisting corrupted state
    }

    // Persist full accumulated text upon successful completion
    if (accumulatedText.trim().length > 0) {
      const cleaned = accumulatedText.replace(/<\/?UNTRUSTED_USER_INPUT>/gi, "").trim();
      await conversationRepository.addTurn({
        conversationId,
        speaker: "assistant",
        text: cleaned,
      });
    }
  }

  /**
   * Concludes a conversation session and calculates final duration.
   */
  async endConversation(conversationId: string) {
    try {
      const conversation = await conversationRepository.getConversationHistory(conversationId);
      if (!conversation) {
        throw AppError.notFound(`Conversation session '${conversationId}' not found`);
      }

      const now = new Date();
      const durationSeconds = Math.round((now.getTime() - conversation.startedAt.getTime()) / 1000);

      await conversationRepository.createConversation({
        userId: conversation.userId,
        mode: conversation.mode,
        difficulty: conversation.difficulty,
      });

      await learningEventRepository.logEvent({
        userId: conversation.userId,
        eventType: "conversation_completed",
        entityType: "conversation",
        entityId: conversationId,
        payload: { durationSeconds, turnCount: conversation.turns.length },
      });

      logger.info("Ended conversation session", { conversationId, durationSeconds });

      return { conversationId, status: "completed", durationSeconds };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to end conversation", { conversationId }, error);
      throw AppError.database("Error concluding conversation session", error);
    }
  }
}

export const conversationService = new ConversationService();
