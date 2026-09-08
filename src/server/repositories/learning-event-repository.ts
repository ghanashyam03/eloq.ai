import { db } from "../db/client";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface LogLearningEventDTO {
  userId: string;
  eventType: string; // mistake_detected, word_encountered, word_recalled, exercise_passed, conversation_completed
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

const inMemoryEvents: any[] = [];

export class LearningEventRepository {
  async logEvent(dto: LogLearningEventDTO) {
    try {
      const event = await db.learningEvent.create({
        data: {
          userId: dto.userId,
          eventType: dto.eventType,
          entityType: dto.entityType,
          entityId: dto.entityId,
          payload: dto.payload as unknown as Prisma.InputJsonObject,
        },
      });

      logger.info("Log immutable learning event", {
        userId: dto.userId,
        eventType: dto.eventType,
        eventId: event.id,
      });

      return event;
    } catch (error) {
      logger.warn("Database unreachable for logEvent; saving in-memory event", { userId: dto.userId });
      const mockEvent = {
        id: `evt-${Date.now()}`,
        userId: dto.userId,
        eventType: dto.eventType,
        entityType: dto.entityType,
        entityId: dto.entityId,
        payload: dto.payload,
        createdAt: new Date(),
      };
      inMemoryEvents.push(mockEvent);
      return mockEvent as any;
    }
  }

  async getEventsForUser(userId: string, eventType?: string) {
    try {
      return await db.learningEvent.findMany({
        where: {
          userId,
          ...(eventType ? { eventType } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.warn("Database unreachable for getEventsForUser; returning in-memory events", { userId });
      return inMemoryEvents.filter((e) => e.userId === userId && (!eventType || e.eventType === eventType));
    }
  }
}

export const learningEventRepository = new LearningEventRepository();
