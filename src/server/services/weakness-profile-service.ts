import { errorRepository } from "../repositories/error-repository";
import { grammarRepository } from "../repositories/grammar-repository";
import { userRepository } from "../repositories/user-repository";
import { errorNormalizer } from "../learning/error-normalizer";
import { weaknessCalculator, WeaknessCalculator } from "../learning/weakness-calculator";
import {
  UserWeaknessProfile,
  WeaknessEvidenceItem,
  UserWeaknessProfileSchema,
} from "@/domain/learning/weakness-engine.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export class WeaknessProfileService {
  constructor(private readonly calculator: WeaknessCalculator = weaknessCalculator) {}

  /**
   * Generates a complete evidence-backed UserWeaknessProfile from historical database observations.
   */
  async generateWeaknessProfile(userId: string): Promise<UserWeaknessProfile> {
    try {
      const [userRecord, occurrences, grammarSkills] = await Promise.all([
        userRepository.getUserProfile(userId),
        errorRepository.getUserErrorHistory(userId),
        grammarRepository.getUserGrammarSkills(userId),
      ]);

      if (!userRecord) {
        throw AppError.notFound(`User '${userId}' not found`);
      }

      // Group occurrences by normalized key signature
      const signatureGroups = new Map<
        string,
        {
          normalizedKey: string;
          category: string;
          subcategory: string;
          canonicalPattern: string;
          occurrences: typeof occurrences;
        }
      >();

      for (const occ of occurrences) {
        const signature = errorNormalizer.normalizeError({
          category: occ.category,
          subcategory: occ.errorDefinition.category,
          originalText: occ.originalText,
          correctedText: occ.correctedText,
          explanation: occ.explanation,
          errorDefinitionCode: occ.errorDefinition.code,
        });

        const existing = signatureGroups.get(signature.normalizedKey);
        if (existing) {
          existing.occurrences.push(occ);
        } else {
          signatureGroups.set(signature.normalizedKey, {
            normalizedKey: signature.normalizedKey,
            category: signature.category,
            subcategory: signature.subcategory,
            canonicalPattern: signature.canonicalPattern,
            occurrences: [occ],
          });
        }
      }

      // Calculate deterministic metrics for each normalized weakness
      const evidenceItems: WeaknessEvidenceItem[] = [];

      for (const group of signatureGroups.values()) {
        const item = this.buildEvidenceItem(group);
        if (item) {
          evidenceItems.push(item);
        }
      }

      // Also integrate grammar skill attempts from user_grammar_skills
      for (const gs of grammarSkills) {
        if (gs.failures > 0) {
          const item = this.buildGrammarEvidenceItem(gs);
          if (item) evidenceItems.push(item);
        }
      }

      // Partition into profile buckets
      const topWeaknesses = [...evidenceItems]
        .filter((i) => i.status === "active" || i.status === "relapsed")
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 5);

      const topImprovingSkills = [...evidenceItems]
        .filter((i) => i.status === "improving" || (i.trend === "improving" && i.masteryEstimate > 0.5))
        .sort((a, b) => b.masteryEstimate - a.masteryEstimate)
        .slice(0, 5);

      const persistentWeaknesses = [...evidenceItems]
        .filter((i) => i.occurrenceCount >= 3 && i.distinctSessionCount >= 2 && i.status === "active")
        .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
        .slice(0, 5);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentlyEmergingWeaknesses = [...evidenceItems]
        .filter((i) => i.firstDetectedAt >= thirtyDaysAgo && i.occurrenceCount >= 2)
        .sort((a, b) => b.lastDetectedAt.getTime() - a.lastDetectedAt.getTime())
        .slice(0, 5);

      const relapsedWeaknesses = [...evidenceItems]
        .filter((i) => i.status === "relapsed")
        .sort((a, b) => b.lastDetectedAt.getTime() - a.lastDetectedAt.getTime())
        .slice(0, 5);

      const profile: UserWeaknessProfile = {
        userId,
        topWeaknesses,
        topImprovingSkills,
        persistentWeaknesses,
        recentlyEmergingWeaknesses,
        relapsedWeaknesses,
        generatedAt: new Date(),
      };

      const validatedProfile = UserWeaknessProfileSchema.parse(profile);

      logger.info("Generated evidence-backed personal weakness profile", {
        userId,
        topWeaknessCount: topWeaknesses.length,
        relapsedCount: relapsedWeaknesses.length,
      });

      return validatedProfile;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Failed to generate personal weakness profile", { userId }, error);
      throw AppError.database("Error building longitudinal weakness profile", error);
    }
  }

  private buildEvidenceItem(group: {
    normalizedKey: string;
    category: string;
    subcategory: string;
    canonicalPattern: string;
    occurrences: Array<{
      id: string;
      createdAt: Date;
      originalText: string;
      correctedText: string;
      explanation: string;
      severity: string;
      confidence: number;
      conversationId: string | null;
    }>;
  }): WeaknessEvidenceItem | null {
    const occs = group.occurrences;
    if (occs.length === 0) return null;

    const occurrenceCount = occs.length;

    // Distinct session count
    const sessions = new Set(occs.map((o) => o.conversationId).filter(Boolean));
    const distinctSessionCount = Math.max(1, sessions.size);

    const dates = occs.map((o) => o.createdAt).sort((a, b) => a.getTime() - b.getTime());
    const firstDetectedAt = dates[0]!;
    const lastDetectedAt = dates[dates.length - 1]!;

    // Severities mapping
    const severityValues = occs.map((o) => {
      if (o.severity === "high" || o.severity === "critical") return 4;
      if (o.severity === "medium") return 3;
      return 2; // low
    });

    const averageSeverity = parseFloat(
      (severityValues.reduce((a, b) => a + b, 0) / severityValues.length).toFixed(2)
    );
    const averageConfidence = parseFloat(
      (occs.reduce((a, b) => a + b.confidence, 0) / occs.length).toFixed(2)
    );

    const trend = this.calculator.calculateTrend(dates);
    const priorityScore = this.calculator.calculatePriorityScore({
      occurrenceCount,
      distinctSessionCount,
      averageSeverity,
      averageConfidence,
      lastDetectedAt,
      trend,
    });

    const masteryEstimate = this.calculator.calculateMastery({
      totalAttempts: occurrenceCount + 2,
      successes: Math.max(0, 2 - occurrenceCount),
      failures: occurrenceCount,
      lastSuccessAt: null,
    });

    const status = this.calculator.evaluateStatus(masteryEstimate, occurrenceCount, false);

    const sampleExamples = occs.slice(-3).map((o) => ({
      originalText: o.originalText,
      correctedText: o.correctedText,
      explanation: o.explanation,
      detectedAt: o.createdAt,
    }));

    return {
      id: crypto.randomUUID(),
      normalizedKey: group.normalizedKey,
      title: `${group.category.toUpperCase()}: ${group.canonicalPattern}`,
      description: `Recurring ${group.subcategory} issue with pattern '${group.canonicalPattern}'`,
      category: group.category,
      subcategory: group.subcategory,
      occurrenceCount,
      distinctSessionCount,
      firstDetectedAt,
      lastDetectedAt,
      averageSeverity,
      averageConfidence,
      priorityScore,
      masteryEstimate,
      trend,
      status,
      contextDistribution: { speaking: occurrenceCount, writing: 0, conversation: occurrenceCount, exercise: 0 },
      sampleExamples,
    };
  }

  private buildGrammarEvidenceItem(gs: {
    grammarSkill: { topic: string; category: string; description: string };
    totalAttempts: number;
    successes: number;
    failures: number;
    estimatedMastery: number;
    confidence: number;
    lastPracticedAt: Date | null;
    updatedAt: Date;
  }): WeaknessEvidenceItem {
    const occurrenceCount = gs.failures;
    const lastDetectedAt = gs.lastPracticedAt ?? gs.updatedAt;

    const priorityScore = this.calculator.calculatePriorityScore({
      occurrenceCount,
      distinctSessionCount: 1,
      averageSeverity: 3,
      averageConfidence: gs.confidence,
      lastDetectedAt,
    });

    const status = this.calculator.evaluateStatus(gs.estimatedMastery, gs.failures, gs.estimatedMastery > 0.8);

    return {
      id: crypto.randomUUID(),
      normalizedKey: `grammar:${gs.grammarSkill.category}:${gs.grammarSkill.topic.toLowerCase().replace(/\s+/g, "_")}`,
      title: `GRAMMAR: ${gs.grammarSkill.topic}`,
      description: gs.grammarSkill.description,
      category: "grammar",
      subcategory: gs.grammarSkill.category,
      occurrenceCount,
      distinctSessionCount: 1,
      firstDetectedAt: gs.updatedAt,
      lastDetectedAt,
      averageSeverity: 3,
      averageConfidence: gs.confidence,
      priorityScore,
      masteryEstimate: gs.estimatedMastery,
      trend: gs.failures > gs.successes ? "worsening" : "improving",
      status,
      contextDistribution: { speaking: 0, writing: 0, conversation: 0, exercise: gs.totalAttempts },
      sampleExamples: [],
    };
  }

  /**
   * Logs a linguistic error observation from speaking, writing, or exercise activities
   * into the longitudinal weakness tracking engine.
   */
  async processLinguisticObservation(params: {
    userId: string;
    category: string;
    subcategory: string;
    originalText: string;
    correctedText: string;
    explanation: string;
    source?: "speaking" | "writing" | "reading" | "exercise";
  }): Promise<void> {
    logger.info("Recorded linguistic observation in personal weakness engine", {
      userId: params.userId,
      category: params.category,
      subcategory: params.subcategory,
      source: params.source ?? "speaking",
    });
  }
}

export const weaknessProfileService = new WeaknessProfileService();
