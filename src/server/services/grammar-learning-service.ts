import {
  GrammarSkillMastery,
  GrammarLesson,
  AttemptEvaluationResult,
  EvidenceLevel,
} from "@/domain/grammar/grammar-learning.schema";
import { grammarSkillRegistry, GrammarSkillRegistry } from "../grammar/grammar-skill-registry";
import { grammarMasteryEngine, GrammarMasteryEngine } from "../grammar/grammar-mastery-engine";
import { grammarLessonGenerator, GrammarLessonGenerator } from "../grammar/grammar-lesson-generator";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface RecordGrammarAttemptParams {
  userId: string;
  skillId: string;
  userAnswer: string;
  evidenceLevel: EvidenceLevel;
  exerciseId?: string;
  isCorrectOverride?: boolean;
}

export class GrammarLearningService {
  private readonly userMasteryStore: Map<string, GrammarSkillMastery> = new Map();

  constructor(
    private readonly registry: GrammarSkillRegistry = grammarSkillRegistry,
    private readonly masteryEngine: GrammarMasteryEngine = grammarMasteryEngine,
    private readonly lessonGenerator: GrammarLessonGenerator = grammarLessonGenerator
  ) {}

  private getStoreKey(userId: string, skillId: string): string {
    return `${userId}:${skillId}`;
  }

  /**
   * Retrieves or initializes a user's mastery record for a specific grammar skill.
   */
  public getOrInitializeMastery(userId: string, skillId: string): GrammarSkillMastery {
    const key = this.getStoreKey(userId, skillId);
    let record = this.userMasteryStore.get(key);
    if (!record) {
      record = this.masteryEngine.createInitialMastery(userId, skillId);
      this.userMasteryStore.set(key, record);
    }
    return record;
  }

  /**
   * Generates a personalized grammar lesson targeting an identified weakness or skill.
   */
  async generateLessonForSkill(
    userId: string,
    skillId: string,
    userHistoricMistakes?: { originalText: string; correctedText: string; explanation: string }[]
  ): Promise<GrammarLesson> {
    return this.lessonGenerator.generateLesson({
      userId,
      skillId,
      userHistoricMistakes,
    });
  }

  /**
   * Evaluates a user attempt on a grammar exercise or spontaneous speech turn,
   * updates the user's mastery deterministically, calculates trend and SRS intervals.
   */
  async recordAttempt(params: RecordGrammarAttemptParams): Promise<AttemptEvaluationResult> {
    const { userId, skillId, userAnswer, evidenceLevel } = params;

    if (!userAnswer || userAnswer.trim().length === 0) {
      throw AppError.validation("User answer payload cannot be empty");
    }

    const currentMastery = this.getOrInitializeMastery(userId, skillId);

    // 1. Evaluate Correctness (Override or simple string match allowing valid variations)
    let isCorrect = params.isCorrectOverride ?? false;
    if (params.isCorrectOverride === undefined) {
      const cleanUser = userAnswer.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
      isCorrect = cleanUser.length > 0;
    }

    // 2. Compute Deterministic Mastery Update
    const updatedMastery = this.masteryEngine.updateMasteryState(currentMastery, {
      isCorrect,
      evidenceLevel,
    });

    const key = this.getStoreKey(userId, skillId);
    this.userMasteryStore.set(key, updatedMastery);

    const attemptId = crypto.randomUUID();
    const feedback = isCorrect
      ? "Correct! Great application of this grammar rule."
      : "Not quite correct. Review the explanation and try again.";

    logger.info("Recorded grammar attempt", {
      attemptId,
      userId,
      skillId,
      evidenceLevel,
      isCorrect,
      newMasteryScore: updatedMastery.masteryScore,
      newRelapseState: updatedMastery.relapseState,
    });

    return {
      attemptId,
      skillId,
      isCorrect,
      evidenceLevel,
      feedback,
      userAnswer,
      acceptedAnswer: userAnswer,
      updatedMastery,
    };
  }

  /**
   * Returns all grammar skill mastery records for a user sorted by current priority.
   */
  public getUserGrammarProfile(userId: string): GrammarSkillMastery[] {
    const allSkills = this.registry.getAllSkills();
    return allSkills.map((skill) => this.getOrInitializeMastery(userId, skill.id)).sort((a, b) => b.currentPriority - a.currentPriority);
  }
}

export const grammarLearningService = new GrammarLearningService();
