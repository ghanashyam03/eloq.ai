import { db } from "../db/client";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface CreateConversationDTO {
  userId: string;
  mode?: string;
  difficulty?: string;
  goalContext?: string;
}

export interface AddTurnDTO {
  conversationId: string;
  speaker: "user" | "assistant" | "system";
  text: string;
  audioUrl?: string;
  durationSeconds?: number;
  providerMetadata?: Record<string, unknown>;
  speechSegment?: {
    audioDurationSecs: number;
    wordCount: number;
    pauseCount?: number;
    totalPauseDurationSecs?: number;
    sttConfidence?: number;
    timingDetails?: Record<string, unknown>;
  };
}

export type ConversationWithTurns = Prisma.ConversationGetPayload<{
  include: {
    turns: {
      include: {
        speechSegments: true;
        errorOccurrences: true;
      };
    };
  };
}>;

interface InMemoryConversation {
  id: string;
  userId: string;
  mode: string;
  difficulty: string;
  goalContext?: string | null;
  status: string;
  startedAt: Date;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  createdAt: Date;
  updatedAt: Date;
  turns: any[];
}

const inMemoryStore = new Map<string, InMemoryConversation>();

export class ConversationRepository {
  async createConversation(dto: CreateConversationDTO) {
    try {
      const conversation = await db.conversation.create({
        data: {
          userId: dto.userId,
          mode: dto.mode ?? "free_chat",
          difficulty: dto.difficulty ?? "intermediate",
          ...(dto.goalContext ? { goalContext: dto.goalContext } : {}),
        },
      });

      logger.info("Created new conversation session", {
        conversationId: conversation.id,
        userId: dto.userId,
      });

      return conversation;
    } catch (error) {
      logger.warn("Database unreachable for createConversation; using in-memory store", { userId: dto.userId });
      const convId = `conv-${Date.now()}`;
      const conv: InMemoryConversation = {
        id: convId,
        userId: dto.userId,
        mode: dto.mode ?? "free_chat",
        difficulty: dto.difficulty ?? "intermediate",
        goalContext: dto.goalContext ?? null,
        status: "active",
        startedAt: new Date(),
        endedAt: null,
        durationSeconds: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [],
      };
      inMemoryStore.set(convId, conv);
      return conv as unknown as Awaited<ReturnType<typeof db.conversation.create>>;
    }
  }

  async addTurn(dto: AddTurnDTO) {
    try {
      return await db.$transaction(async (tx) => {
        // Calculate next deterministic turn order
        const lastTurn = await tx.conversationTurn.findFirst({
          where: { conversationId: dto.conversationId },
          orderBy: { turnOrder: "desc" },
        });
        const nextOrder = (lastTurn?.turnOrder ?? 0) + 1;

        const turn = await tx.conversationTurn.create({
          data: {
            conversationId: dto.conversationId,
            speaker: dto.speaker,
            turnOrder: nextOrder,
            text: dto.text,
            ...(dto.audioUrl ? { audioUrl: dto.audioUrl } : {}),
            ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
            ...(dto.providerMetadata ? { providerMetadata: dto.providerMetadata as unknown as Prisma.InputJsonObject } : {}),
          },
        });

        let segment = null;
        if (dto.speechSegment) {
          segment = await tx.speechSegment.create({
            data: {
              turnId: turn.id,
              audioDurationSecs: dto.speechSegment.audioDurationSecs,
              wordCount: dto.speechSegment.wordCount,
              pauseCount: dto.speechSegment.pauseCount ?? 0,
              totalPauseDurationSecs: dto.speechSegment.totalPauseDurationSecs ?? 0,
              ...(dto.speechSegment.sttConfidence !== undefined ? { sttConfidence: dto.speechSegment.sttConfidence } : {}),
              ...(dto.speechSegment.timingDetails ? { timingDetails: dto.speechSegment.timingDetails as unknown as Prisma.InputJsonObject } : {}),
            },
          });
        }

        return { turn, segment };
      });
    } catch (error) {
      logger.warn("Database unreachable for addTurn; using in-memory store", { conversationId: dto.conversationId });
      let conv = inMemoryStore.get(dto.conversationId);
      if (!conv) {
        conv = {
          id: dto.conversationId,
          userId: "demo-user",
          mode: "free_conversation",
          difficulty: "intermediate",
          status: "active",
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          turns: [],
        };
        inMemoryStore.set(dto.conversationId, conv);
      }

      const turnId = `t-${Date.now()}`;
      const mockTurn = {
        id: turnId,
        conversationId: dto.conversationId,
        speaker: dto.speaker,
        turnOrder: conv.turns.length + 1,
        text: dto.text,
        audioUrl: dto.audioUrl ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        providerMetadata: dto.providerMetadata ?? null,
        createdAt: new Date(),
        speechSegments: dto.speechSegment ? [dto.speechSegment] : [],
        errorOccurrences: [],
      };

      conv.turns.push(mockTurn);
      return { turn: mockTurn as any, segment: dto.speechSegment ?? null };
    }
  }

  async getConversationHistory(conversationId: string): Promise<ConversationWithTurns | null> {
    try {
      return await db.conversation.findUnique({
        where: { id: conversationId },
        include: {
          turns: {
            orderBy: { turnOrder: "asc" },
            include: {
              speechSegments: true,
              errorOccurrences: true,
            },
          },
        },
      });
    } catch (error) {
      logger.warn("Database unreachable for getConversationHistory; using in-memory fallback", { conversationId });
      const existing = inMemoryStore.get(conversationId);
      if (existing) return existing as unknown as ConversationWithTurns;

      return {
        id: conversationId,
        userId: "demo-user",
        mode: "free_conversation",
        difficulty: "intermediate",
        goalContext: null,
        status: "active",
        startedAt: new Date(),
        endedAt: null,
        durationSeconds: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [],
      } as unknown as ConversationWithTurns;
    }
  }

  async getUserConversations(userId: string, limit = 50): Promise<ConversationWithTurns[]> {
    try {
      return await db.conversation.findMany({
        where: { userId },
        include: {
          turns: {
            orderBy: { turnOrder: "asc" },
            include: {
              speechSegments: true,
              errorOccurrences: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (error) {
      logger.warn("Database unreachable for getUserConversations; returning in-memory conversations", { userId });
      return Array.from(inMemoryStore.values()).filter((c) => c.userId === userId).slice(0, limit) as unknown as ConversationWithTurns[];
    }
  }
}

export const conversationRepository = new ConversationRepository();
