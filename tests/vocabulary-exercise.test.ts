import { describe, it, expect } from "vitest";
import { vocabularyExerciseGenerator } from "@/server/vocabulary/vocabulary-exercise-generator";
import { VocabularyEntity } from "@/domain/vocabulary/vocabulary.schema";

const VALID_UUID = "12345678-1234-4234-8234-123456789abc";

describe("Vocabulary Exercise Generator & Evaluator", () => {
  const sampleVocab: VocabularyEntity = {
    id: VALID_UUID,
    word: "mitigate",
    lemma: "mitigate",
    partOfSpeech: "verb",
    definition: "To make something less severe",
    register: "academic",
    difficulty: "B2",
    collocations: ["mitigate risk", "mitigate damage"],
    synonyms: ["alleviate"],
    antonyms: ["exacerbate"],
    exampleSentences: ["We must mitigate risk."],
    isModelGenerated: false,
  };

  it("should generate sentence_gap_fill exercise for production review", () => {
    const exercise = vocabularyExerciseGenerator.generateExercise(sampleVocab, "production", "sentence_gap_fill");

    expect(exercise.vocabularyItemId).toBe(VALID_UUID);
    expect(exercise.exerciseType).toBe("sentence_gap_fill");
    expect(exercise.canonicalAnswers).toContain("mitigate");
  });

  it("should evaluate missing target word as incorrect", () => {
    const exercise = vocabularyExerciseGenerator.generateExercise(sampleVocab, "production", "sentence_gap_fill");
    const evalResult = vocabularyExerciseGenerator.evaluateResponse(exercise, "We should stop the problem.");

    expect(evalResult.isCorrect).toBe(false);
    expect(evalResult.rating).toBe("incorrect");
    expect(evalResult.score).toBe(0.0);
  });

  it("should evaluate sentence creation without required collocation as correct_unnatural", () => {
    const exercise = vocabularyExerciseGenerator.generateExercise(sampleVocab, "production", "sentence_creation");
    const evalResult = vocabularyExerciseGenerator.evaluateResponse(exercise, "I mitigate.");

    expect(evalResult.isCorrect).toBe(true);
    expect(evalResult.rating).toBe("correct_unnatural");
    expect(evalResult.score).toBe(0.65);
  });

  it("should evaluate natural usage with target collocation as correct_natural", () => {
    const exercise = vocabularyExerciseGenerator.generateExercise(sampleVocab, "production", "sentence_creation");
    const evalResult = vocabularyExerciseGenerator.evaluateResponse(
      exercise,
      "We took strategic actions to mitigate risk during the crisis."
    );

    expect(evalResult.isCorrect).toBe(true);
    expect(evalResult.rating).toBe("correct_natural");
    expect(evalResult.score).toBe(1.0);
  });
});
