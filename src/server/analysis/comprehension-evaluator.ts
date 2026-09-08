import {
  ComprehensionQuestion,
  ComprehensionAnswerEvaluation,
  ComprehensionAnswerEvaluationSchema,
} from "@/domain/content/reading-listening.schema";
import { modelRouter, ModelRouter } from "../providers/llm/router/model-router";
import { logger } from "@/lib/logger/logger";

export class ComprehensionEvaluator {
  constructor(private readonly router: ModelRouter = modelRouter) {}

  /**
   * Evaluates a user answer against a comprehension question.
   * Uses deterministic checks for multiple choice, and semantic equivalence evaluation for open responses.
   */
  async evaluateAnswer(
    question: ComprehensionQuestion,
    userAnswer: string
  ): Promise<ComprehensionAnswerEvaluation> {
    const cleanUser = userAnswer.trim();
    if (!cleanUser) {
      return ComprehensionAnswerEvaluationSchema.parse({
        questionId: question.id,
        isCorrect: false,
        isSemanticallyEquivalent: false,
        scorePercentage: 0,
        feedback: "No answer provided.",
        userAnswer: "",
        referenceAnswer: question.referenceAnswer,
        matchedConcepts: [],
        missingConcepts: question.acceptableConcepts,
      });
    }

    // 1. Multiple Choice Deterministic Check
    if (question.options && question.options.length > 0) {
      const cleanReference = question.referenceAnswer.toLowerCase().trim();
      const cleanUserLower = cleanUser.toLowerCase();

      const isExact =
        cleanUserLower === cleanReference ||
        cleanUserLower.startsWith(cleanReference.charAt(0)) ||
        cleanReference.includes(cleanUserLower);

      return ComprehensionAnswerEvaluationSchema.parse({
        questionId: question.id,
        isCorrect: isExact,
        isSemanticallyEquivalent: isExact,
        scorePercentage: isExact ? 100 : 0,
        feedback: isExact ? "Correct selection!" : `Incorrect. The correct answer is: ${question.referenceAnswer}`,
        userAnswer: cleanUser,
        referenceAnswer: question.referenceAnswer,
        matchedConcepts: isExact ? question.acceptableConcepts : [],
        missingConcepts: isExact ? [] : question.acceptableConcepts,
      });
    }

    // 2. Open Answer Semantic Equivalence Evaluation
    const semanticMatch = this.checkSemanticEquivalence(cleanUser, question.referenceAnswer, question.acceptableConcepts);

    const isCorrect = semanticMatch.scorePercentage >= 70;
    const feedback = isCorrect
      ? "Semantically correct! Your answer captures the essential meaning."
      : `Your answer missed key details. Reference answer: ${question.referenceAnswer}`;

    const evaluationPayload: ComprehensionAnswerEvaluation = {
      questionId: question.id,
      isCorrect,
      isSemanticallyEquivalent: semanticMatch.isSemanticallyEquivalent,
      scorePercentage: semanticMatch.scorePercentage,
      feedback,
      userAnswer: cleanUser,
      referenceAnswer: question.referenceAnswer,
      matchedConcepts: semanticMatch.matchedConcepts,
      missingConcepts: semanticMatch.missingConcepts,
    };

    logger.info("Evaluated comprehension answer", {
      questionId: question.id,
      isCorrect,
      scorePercentage: semanticMatch.scorePercentage,
    });

    return ComprehensionAnswerEvaluationSchema.parse(evaluationPayload);
  }

  /**
   * Deterministic semantic equivalence fallback comparing key concepts and phrase overlaps.
   */
  private checkSemanticEquivalence(
    userAnswer: string,
    referenceAnswer: string,
    acceptableConcepts: string[]
  ): { isSemanticallyEquivalent: boolean; scorePercentage: number; matchedConcepts: string[]; missingConcepts: string[] } {
    const userLower = userAnswer.toLowerCase();
    const matchedConcepts: string[] = [];
    const missingConcepts: string[] = [];

    // Check key concept inclusion (any matching acceptable concept counts towards equivalence)
    acceptableConcepts.forEach((concept) => {
      if (userLower.includes(concept.toLowerCase())) {
        matchedConcepts.push(concept);
      } else {
        missingConcepts.push(concept);
      }
    });

    // Check core word overlap with reference answer
    const refWords = referenceAnswer.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const userWords = new Set(userLower.split(/\s+/));
    const overlapCount = refWords.filter((w) => userWords.has(w)).length;

    let scorePercentage = 0;
    if (matchedConcepts.length > 0) {
      // If at least one acceptable concept or paraphrase matched, treat as semantically equivalent (100%)
      scorePercentage = 100;
    } else if (refWords.length > 0) {
      scorePercentage = Math.round((overlapCount / refWords.length) * 100);
    } else {
      scorePercentage = userLower === referenceAnswer.toLowerCase() ? 100 : 50;
    }

    return {
      isSemanticallyEquivalent: scorePercentage >= 70,
      scorePercentage,
      matchedConcepts,
      missingConcepts,
    };
  }
}

export const comprehensionEvaluator = new ComprehensionEvaluator();
