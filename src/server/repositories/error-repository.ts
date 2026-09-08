import { db } from "../db/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface RecordErrorOccurrenceDTO {
  userId: string;
  errorCode: string;
  conversationId?: string;
  turnId?: string;
  originalText: string;
  correctedText: string;
  explanation: string;
  category: string;
  severity?: "low" | "medium" | "high";
  confidence?: number;
}

const inMemoryErrors: any[] = [];

export class ErrorRepository {
  async recordOccurrence(dto: RecordErrorOccurrenceDTO) {
    try {
      const errorDef = await db.errorDefinition.findUnique({
        where: { code: dto.errorCode },
      });

      if (!errorDef) {
        throw AppError.notFound(`ErrorDefinition code '${dto.errorCode}' not found`);
      }

      const occurrence = await db.errorOccurrence.create({
        data: {
          userId: dto.userId,
          errorDefinitionId: errorDef.id,
          originalText: dto.originalText,
          correctedText: dto.correctedText,
          explanation: dto.explanation,
          category: dto.category,
          severity: dto.severity ?? "medium",
          confidence: dto.confidence ?? 1.0,
          ...(dto.conversationId ? { conversationId: dto.conversationId } : {}),
          ...(dto.turnId ? { turnId: dto.turnId } : {}),
        },
      });

      logger.info("Recorded error occurrence evidence", {
        userId: dto.userId,
        errorCode: dto.errorCode,
        occurrenceId: occurrence.id,
      });

      return occurrence;
    } catch (error) {
      if (error instanceof AppError && error.code === "NOT_FOUND_ERROR") throw error;
      logger.warn("Database unreachable for recordOccurrence; saving in-memory", { userId: dto.userId });
      const mockOcc = {
        id: `err-occ-${Date.now()}`,
        userId: dto.userId,
        errorDefinitionId: `def-${dto.errorCode}`,
        originalText: dto.originalText,
        correctedText: dto.correctedText,
        explanation: dto.explanation,
        category: dto.category,
        severity: dto.severity ?? "medium",
        confidence: dto.confidence ?? 1.0,
        conversationId: dto.conversationId ?? null,
        turnId: dto.turnId ?? null,
        createdAt: new Date(),
      };
      inMemoryErrors.push(mockOcc);
      return mockOcc as any;
    }
  }

  async getUserErrorHistory(userId: string, category?: string) {
    try {
      return await db.errorOccurrence.findMany({
        where: {
          userId,
          ...(category ? { category } : {}),
        },
        include: {
          errorDefinition: true,
          turn: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.warn("Database unreachable for getUserErrorHistory; returning in-memory history", { userId });
      return inMemoryErrors.filter((e) => e.userId === userId && (!category || e.category === category));
    }
  }
}

export const errorRepository = new ErrorRepository();
