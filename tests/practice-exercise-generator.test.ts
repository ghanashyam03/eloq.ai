import { describe, it, expect } from "vitest";
import { practiceExerciseGenerator } from "@/server/practice/practice-exercise-generator";
import { PracticeExercise } from "@/domain/practice/practice.schema";

describe("Practice Exercise Generator & Validator", () => {
  it("should generate valid exercises across exercise types", () => {
    const exercise = practiceExerciseGenerator.generateExercise({
      targetSkillType: "error",
      targetCategory: "preposition",
      title: "interested in",
      exerciseType: "correction",
      progressionStage: "controlled_production",
      difficulty: "B1",
      selectionReason: "Selected because preposition error is active weakness.",
    });

    expect(exercise.exerciseType).toBe("correction");
    expect(exercise.targetSkillType).toBe("error");
    expect(exercise.learningObjective).toBeDefined();
    expect(exercise.selectionReason).toContain("preposition error");
  });

  it("should validate exercise integrity and pass valid exercises", () => {
    const valid = practiceExerciseGenerator.generateExercise({
      targetSkillType: "vocabulary",
      targetCategory: "vocabulary",
      title: "mitigate",
      exerciseType: "fill_blank",
      progressionStage: "controlled_production",
      difficulty: "B2",
      selectionReason: "Selected for active vocabulary practice.",
    });

    expect(practiceExerciseGenerator.validateExercise(valid)).toBe(true);
  });

  it("should reject malformed exercises with empty prompt or expected answer", () => {
    const malformed = {
      id: crypto.randomUUID(),
      title: "Bad Exercise",
      exerciseType: "correction" as const,
      progressionStage: "controlled_production" as const,
      targetSkillType: "error" as const,
      targetCategory: "grammar",
      instructions: "Do something",
      promptText: "", // Empty prompt!
      expectedAnswer: "Correct",
      canonicalAnswers: [],
      difficulty: "B1",
      selectionReason: "Some reason",
      learningObjective: "Some objective",
      expectedLearningValue: 5.0,
    } as PracticeExercise;

    expect(() => practiceExerciseGenerator.validateExercise(malformed)).toThrow("prompt text cannot be empty");
  });
});
