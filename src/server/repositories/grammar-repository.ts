import { db } from "../db/client";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface RecordGrammarAttemptDTO {
  userId: string;
  grammarSkillCode: string;
  isSuccess: boolean;
}

export class GrammarRepository {
  async recordAttempt(dto: RecordGrammarAttemptDTO) {
    try {
      const skill = await db.grammarSkill.findUnique({
        where: { code: dto.grammarSkillCode },
      });

      if (!skill) {
        throw AppError.notFound(`GrammarSkill '${dto.grammarSkillCode}' not found`);
      }

      return await db.$transaction(async (tx) => {
        const existing = await tx.userGrammarSkill.findUnique({
          where: {
            userId_grammarSkillId: {
              userId: dto.userId,
              grammarSkillId: skill.id,
            },
          },
        });

        const totalAttempts = (existing?.totalAttempts ?? 0) + 1;
        const successes = (existing?.successes ?? 0) + (dto.isSuccess ? 1 : 0);
        const failures = (existing?.failures ?? 0) + (dto.isSuccess ? 0 : 1);

        // Calculated mastery incorporates sample size & evidence confidence
        const estimatedMastery = Math.min(1.0, Math.max(0.0, successes / totalAttempts));
        const confidence = Math.min(1.0, totalAttempts / 10.0); // Full confidence after 10 sample evaluations

        const userSkill = await tx.userGrammarSkill.upsert({
          where: {
            userId_grammarSkillId: {
              userId: dto.userId,
              grammarSkillId: skill.id,
            },
          },
          update: {
            totalAttempts,
            successes,
            failures,
            estimatedMastery,
            confidence,
            recentPerformance: dto.isSuccess ? 1.0 : 0.0,
            lastPracticedAt: new Date(),
          },
          create: {
            userId: dto.userId,
            grammarSkillId: skill.id,
            totalAttempts: 1,
            successes: dto.isSuccess ? 1 : 0,
            failures: dto.isSuccess ? 0 : 1,
            estimatedMastery: dto.isSuccess ? 1.0 : 0.0,
            confidence: 0.1,
            recentPerformance: dto.isSuccess ? 1.0 : 0.0,
            lastPracticedAt: new Date(),
          },
        });

        logger.info("Recorded grammar skill attempt", {
          userId: dto.userId,
          grammarSkillCode: dto.grammarSkillCode,
          estimatedMastery,
          confidence,
        });

        return userSkill;
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to record grammar attempt", { userId: dto.userId }, error);
      throw AppError.database("Error updating user grammar skill mastery", error);
    }
  }

  async getUserGrammarSkills(userId: string) {
    try {
      return await db.userGrammarSkill.findMany({
        where: { userId },
        include: { grammarSkill: true },
        orderBy: { estimatedMastery: "asc" },
      });
    } catch (error) {
      logger.error("Failed to fetch user grammar skills", { userId }, error);
      throw AppError.database("Error fetching user grammar skill history", error);
    }
  }
}

export const grammarRepository = new GrammarRepository();
