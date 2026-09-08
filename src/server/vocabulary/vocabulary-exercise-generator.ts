import {
  VocabularyEntity,
  VocabularyExercise,
  ExerciseType,
  ReviewType,
  ExerciseEvaluationResult,
} from "@/domain/vocabulary/vocabulary.schema";
import { vocabularyNormalizer } from "./vocabulary-normalizer";

export class VocabularyExerciseGenerator {
  /**
   * Generates a targeted active retrieval exercise for a given vocabulary concept.
   */
  generateExercise(
    vocab: VocabularyEntity,
    reviewType: ReviewType = "production",
    exerciseType?: ExerciseType
  ): VocabularyExercise {
    const selectedType: ExerciseType =
      exerciseType ?? (reviewType === "recognition" ? "context_selection" : "sentence_gap_fill");

    const id = crypto.randomUUID();
    const primaryCollocation = vocab.collocations[0] ?? `${vocab.word} in context`;

    switch (selectedType) {
      case "sentence_gap_fill":
        return {
          id,
          vocabularyItemId: vocab.id,
          word: vocab.word,
          lemma: vocab.lemma,
          exerciseType: "sentence_gap_fill",
          reviewType,
          instructions: `Fill in the blank with the correct form of '${vocab.word}' to complete the sentence.`,
          prompt: `We must take immediate action to ________ potential risks before they escalate.`,
          canonicalAnswers: [vocab.word, vocab.lemma, primaryCollocation],
          targetCollocation: primaryCollocation,
          difficulty: vocab.difficulty,
        };

      case "sentence_creation":
        return {
          id,
          vocabularyItemId: vocab.id,
          word: vocab.word,
          lemma: vocab.lemma,
          exerciseType: "sentence_creation",
          reviewType,
          instructions: `Write a complete, natural sentence using the word '${vocab.word}' with the collocation '${primaryCollocation}'.`,
          prompt: `Create a professional sentence using '${vocab.word}'.`,
          canonicalAnswers: [vocab.word, primaryCollocation],
          targetCollocation: primaryCollocation,
          difficulty: vocab.difficulty,
        };

      case "precision_replacement":
        return {
          id,
          vocabularyItemId: vocab.id,
          word: vocab.word,
          lemma: vocab.lemma,
          exerciseType: "precision_replacement",
          reviewType,
          instructions: `Replace the underlined vague phrase "make less severe" with the precise vocabulary word '${vocab.word}'.`,
          prompt: `Original: "The team worked hard to make less severe the negative impact of the crisis."`,
          canonicalAnswers: [vocab.word, vocab.lemma],
          targetCollocation: primaryCollocation,
          difficulty: vocab.difficulty,
        };

      case "context_selection":
        return {
          id,
          vocabularyItemId: vocab.id,
          word: vocab.word,
          lemma: vocab.lemma,
          exerciseType: "context_selection",
          reviewType: "recognition",
          instructions: `Select the most appropriate word to complete the formal statement.`,
          prompt: `The new policy is intended to ________ the environmental damage caused by heavy industry.`,
          options: [vocab.word, "make bad", "do small", "stop quick"],
          canonicalAnswers: [vocab.word],
          targetCollocation: primaryCollocation,
          difficulty: vocab.difficulty,
        };

      case "concept_explanation":
      case "question_response":
      default:
        return {
          id,
          vocabularyItemId: vocab.id,
          word: vocab.word,
          lemma: vocab.lemma,
          exerciseType: "question_response",
          reviewType,
          instructions: `Answer the question in a full sentence using the target word '${vocab.word}'.`,
          prompt: `How can organizations prepare for unexpected market disruptions?`,
          canonicalAnswers: [vocab.word, primaryCollocation],
          targetCollocation: primaryCollocation,
          difficulty: vocab.difficulty,
        };
    }
  }

  /**
   * Evaluates user exercise response deterministically, distinguishing correct natural vs correct unnatural vs incorrect.
   */
  evaluateResponse(
    exercise: VocabularyExercise,
    userResponse: string
  ): ExerciseEvaluationResult {
    const raw = userResponse.trim();
    const normalizedResponse = vocabularyNormalizer.normalizeWord(raw);
    const lemmasInResponse = vocabularyNormalizer.extractLemmas(raw);
    const targetLemma = vocabularyNormalizer.getLemma(exercise.word);

    if (!raw) {
      return {
        exerciseId: exercise.id,
        userResponse: "",
        rating: "incorrect",
        score: 0.0,
        feedback: "No response was provided.",
        isCorrect: false,
      };
    }

    const containsTargetWord =
      normalizedResponse.includes(targetLemma) ||
      lemmasInResponse.includes(targetLemma) ||
      exercise.canonicalAnswers.some((ans) => raw.toLowerCase().includes(ans.toLowerCase()));

    if (!containsTargetWord) {
      return {
        exerciseId: exercise.id,
        userResponse,
        rating: "incorrect",
        score: 0.0,
        feedback: `Your answer did not include the target word '${exercise.word}'.`,
        suggestedAlternative: `Use '${exercise.word}' in context (e.g. "${exercise.targetCollocation ?? exercise.word}").`,
        isCorrect: false,
      };
    }

    // Check naturalness criteria (collocation matching, sentence length/structure)
    const hasCollocation =
      exercise.targetCollocation &&
      raw.toLowerCase().includes(exercise.targetCollocation.toLowerCase());

    const isAwkwardOrShort = raw.split(/\s+/).length < 3 && exercise.exerciseType === "sentence_creation";

    if (isAwkwardOrShort || (!hasCollocation && exercise.exerciseType === "sentence_creation")) {
      return {
        exerciseId: exercise.id,
        userResponse,
        rating: "correct_unnatural",
        score: 0.65,
        feedback: `You used '${exercise.word}' correctly, but the phrasing is slightly unnatural or incomplete.`,
        suggestedAlternative: `Try incorporating the natural collocation '${exercise.targetCollocation ?? exercise.word}'.`,
        isCorrect: true,
      };
    }

    return {
      exerciseId: exercise.id,
      userResponse,
      rating: "correct_natural",
      score: 1.0,
      feedback: `Flawless and natural usage of '${exercise.word}'!`,
      isCorrect: true,
    };
  }
}

export const vocabularyExerciseGenerator = new VocabularyExerciseGenerator();
