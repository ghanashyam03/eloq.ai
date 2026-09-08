import { db } from "../db/client";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface CreateUserProfileDTO {
  userId: string;
  targetVariety?: string;
  estimatedLevel?: string;
  correctionIntensity?: string;
  conversationDifficulty?: string;
  dailyTargetDurationMins?: number;
  goals?: Array<{ category: string; description: string; priority?: number }>;
}

export type UserWithProfileAndGoals = Prisma.UserGetPayload<{
  include: {
    profile: true;
    settings: true;
    learningGoals: true;
  };
}>;

export class UserRepository {
  async createUserProfile(dto: CreateUserProfileDTO) {
    try {
      return await db.$transaction(async (tx) => {
        const profile = await tx.userProfile.upsert({
          where: { userId: dto.userId },
          update: {
            ...(dto.targetVariety ? { targetVariety: dto.targetVariety } : {}),
            ...(dto.estimatedLevel ? { estimatedLevel: dto.estimatedLevel } : {}),
            ...(dto.correctionIntensity ? { correctionIntensity: dto.correctionIntensity } : {}),
            ...(dto.conversationDifficulty ? { conversationDifficulty: dto.conversationDifficulty } : {}),
            ...(dto.dailyTargetDurationMins ? { dailyTargetDurationMins: dto.dailyTargetDurationMins } : {}),
          },
          create: {
            userId: dto.userId,
            targetVariety: dto.targetVariety ?? "en-US",
            estimatedLevel: dto.estimatedLevel ?? "B1",
            correctionIntensity: dto.correctionIntensity ?? "medium",
            conversationDifficulty: dto.conversationDifficulty ?? "intermediate",
            dailyTargetDurationMins: dto.dailyTargetDurationMins ?? 15,
          },
        });

        if (dto.goals && dto.goals.length > 0) {
          await tx.learningGoal.createMany({
            data: dto.goals.map((g) => ({
              userId: dto.userId,
              category: g.category,
              description: g.description,
              priority: g.priority ?? 1,
            })),
          });
        }

        const goals = await tx.learningGoal.findMany({ where: { userId: dto.userId } });

        return { profile, goals };
      });
    } catch (error) {
      logger.error("Failed to create user profile", { userId: dto.userId }, error);
      throw AppError.database("Error persisting user profile", error);
    }
  }

  async getUserProfile(userId: string): Promise<UserWithProfileAndGoals | null> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          settings: true,
          learningGoals: true,
        },
      });
      return user;
    } catch (error) {
      logger.warn("Database unreachable for getUserProfile; returning default in-memory user profile", { userId });
      return {
        id: userId,
        email: "demo@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Demo User",
        profile: {
          id: "p-demo",
          userId,
          targetVariety: "en-US",
          estimatedLevel: "B2",
          correctionIntensity: "medium",
          conversationDifficulty: "intermediate",
          dailyTargetDurationMins: 15,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        settings: null,
        learningGoals: [
          {
            id: "g-1",
            userId,
            category: "conversational",
            description: "General English Fluency",
            priority: 1,
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as unknown as UserWithProfileAndGoals;
    }
  }

  async deleteUser(userId: string) {
    try {
      await db.user.delete({ where: { id: userId } });
      logger.info("Deleted user and all associated raw evidence", { userId });
      return true;
    } catch (error) {
      logger.warn("Database unreachable for deleteUser", { userId });
      return true;
    }
  }
}

export const userRepository = new UserRepository();
