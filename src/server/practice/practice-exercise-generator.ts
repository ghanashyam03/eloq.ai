import {
  PracticeExercise,
  ExerciseType,
  ProgressionStage,
  TargetSkillType,
} from "@/domain/practice/practice.schema";
import { AppError } from "@/lib/errors/app-error";

export interface ExerciseGenerationRequest {
  targetSkillType: TargetSkillType;
  targetCategory: string;
  title: string;
  exerciseType: ExerciseType;
  progressionStage: ProgressionStage;
  difficulty: string;
  selectionReason: string;
  grammarSkillId?: string;
  vocabularyItemId?: string;
  errorDefinitionId?: string;
  expectedLearningValue?: number;
}

export class PracticeExerciseGenerator {
  /**
   * Generates a fully formed, targeted practice exercise.
   */
  generateExercise(req: ExerciseGenerationRequest): PracticeExercise {
    const id = crypto.randomUUID();
    let exercise: PracticeExercise;

    switch (req.exerciseType) {
      case "correction":
        exercise = {
          id,
          title: `Correct: ${req.title}`,
          exerciseType: "correction",
          progressionStage: req.progressionStage,
          targetSkillType: req.targetSkillType,
          targetCategory: req.targetCategory,
          instructions: "Identify and correct the grammatical error in the sentence.",
          promptText: "Incorrect: 'I am interested on astrophysics.'",
          expectedAnswer: "I am interested in astrophysics.",
          canonicalAnswers: ["I am interested in astrophysics."],
          difficulty: req.difficulty,
          selectionReason: req.selectionReason,
          learningObjective: `Master correct usage of prepositions in '${req.targetCategory}'.`,
          expectedLearningValue: req.expectedLearningValue ?? 7.5,
          ...(req.errorDefinitionId !== undefined ? { errorDefinitionId: req.errorDefinitionId } : {}),
          ...(req.grammarSkillId !== undefined ? { grammarSkillId: req.grammarSkillId } : {}),
        };
        break;

      case "multiple_choice":
        exercise = {
          id,
          title: `Select: ${req.title}`,
          exerciseType: "multiple_choice",
          progressionStage: "recognition",
          targetSkillType: req.targetSkillType,
          targetCategory: req.targetCategory,
          instructions: "Choose the grammatically correct option to complete the sentence.",
          promptText: "She has been studying English ________ three years.",
          expectedAnswer: "for",
          canonicalAnswers: ["for"],
          options: ["for", "since", "during", "from"],
          difficulty: req.difficulty,
          selectionReason: req.selectionReason,
          learningObjective: "Distinguish between 'for' and 'since' in duration clauses.",
          expectedLearningValue: req.expectedLearningValue ?? 6.0,
          ...(req.grammarSkillId !== undefined ? { grammarSkillId: req.grammarSkillId } : {}),
        };
        break;

      case "fill_blank":
        exercise = {
          id,
          title: `Fill Blank: ${req.title}`,
          exerciseType: "fill_blank",
          progressionStage: req.progressionStage,
          targetSkillType: req.targetSkillType,
          targetCategory: req.targetCategory,
          instructions: "Fill in the blank with the appropriate word.",
          promptText: "We need to ________ potential risks before launching the project.",
          expectedAnswer: "mitigate",
          canonicalAnswers: ["mitigate"],
          difficulty: req.difficulty,
          selectionReason: req.selectionReason,
          learningObjective: `Use the target vocabulary word '${req.title}' accurately.`,
          expectedLearningValue: req.expectedLearningValue ?? 8.0,
          ...(req.vocabularyItemId !== undefined ? { vocabularyItemId: req.vocabularyItemId } : {}),
        };
        break;

      case "sentence_creation":
        exercise = {
          id,
          title: `Create Sentence: ${req.title}`,
          exerciseType: "sentence_creation",
          progressionStage: "guided_production",
          targetSkillType: req.targetSkillType,
          targetCategory: req.targetCategory,
          instructions: `Construct a complete, natural sentence incorporating '${req.title}'.`,
          promptText: `Write a professional sentence using '${req.title}' in context.`,
          expectedAnswer: `We implemented measures to ${req.title} risk.`,
          canonicalAnswers: [req.title],
          difficulty: req.difficulty,
          selectionReason: req.selectionReason,
          learningObjective: `Demonstrate active production of '${req.title}' with natural collocation.`,
          expectedLearningValue: req.expectedLearningValue ?? 8.5,
          ...(req.vocabularyItemId !== undefined ? { vocabularyItemId: req.vocabularyItemId } : {}),
        };
        break;

      case "vocabulary_production":
        exercise = {
          id,
          title: `Recall Word: ${req.title}`,
          exerciseType: "vocabulary_production",
          progressionStage: "controlled_production",
          targetSkillType: "vocabulary",
          targetCategory: req.targetCategory,
          instructions: "Provide the precise vocabulary word matching the definition.",
          promptText: "Definition: 'To make something less harmful, serious, or severe.'",
          expectedAnswer: "mitigate",
          canonicalAnswers: ["mitigate"],
          difficulty: req.difficulty,
          selectionReason: req.selectionReason,
          learningObjective: "Recall active vocabulary from concept definitions.",
          expectedLearningValue: req.expectedLearningValue ?? 7.8,
          ...(req.vocabularyItemId !== undefined ? { vocabularyItemId: req.vocabularyItemId } : {}),
        };
        break;

      case "speaking_prompt":
        exercise = {
          id,
          title: `Speak: ${req.title}`,
          exerciseType: "speaking_prompt",
          progressionStage: "spontaneous_production",
          targetSkillType: "speaking",
          targetCategory: req.targetCategory,
          instructions: "Respond verbally in 2-3 natural sentences addressing the prompt.",
          promptText: "Describe a situation where your team had to manage unexpected challenges.",
          expectedAnswer: "In my previous project, we faced unexpected delays...",
          canonicalAnswers: ["mitigate", "manage", "address"],
          difficulty: req.difficulty,
          selectionReason: req.selectionReason,
          learningObjective: "Practice spontaneous verbal production in professional scenarios.",
          expectedLearningValue: req.expectedLearningValue ?? 9.0,
        };
        break;

      case "grammar_transformation":
        exercise = {
          id,
          title: `Transform: ${req.title}`,
          exerciseType: "grammar_transformation",
          progressionStage: "controlled_production",
          targetSkillType: "grammar",
          targetCategory: req.targetCategory,
          instructions: "Transform the sentence into the Present Perfect tense.",
          promptText: "Direct: 'I finished the report yesterday.' -> Present Perfect: '________'",
          expectedAnswer: "I have finished the report.",
          canonicalAnswers: ["I have finished the report.", "I've finished the report."],
          difficulty: req.difficulty,
          selectionReason: req.selectionReason,
          learningObjective: "Transform past simple structures into present perfect tense.",
          expectedLearningValue: req.expectedLearningValue ?? 8.2,
          ...(req.grammarSkillId !== undefined ? { grammarSkillId: req.grammarSkillId } : {}),
        };
        break;

      case "contextual_usage":
      default:
        exercise = {
          id,
          title: `Context: ${req.title}`,
          exerciseType: "contextual_usage",
          progressionStage: req.progressionStage,
          targetSkillType: req.targetSkillType,
          targetCategory: req.targetCategory,
          instructions: "Select the most appropriate formal register phrase.",
          promptText: "Which phrase is most appropriate for an academic email?",
          expectedAnswer: "I am writing to inquire regarding...",
          canonicalAnswers: ["I am writing to inquire regarding..."],
          options: [
            "I am writing to inquire regarding...",
            "Hey, wanted to ask about...",
            "Gimme info on...",
          ],
          difficulty: req.difficulty,
          selectionReason: req.selectionReason,
          learningObjective: "Apply appropriate register and tone in academic communication.",
          expectedLearningValue: req.expectedLearningValue ?? 7.0,
        };
        break;
    }

    this.validateExercise(exercise);
    return exercise;
  }

  /**
   * Validates exercise integrity, ensuring target skill, objective, and non-ambiguity.
   */
  validateExercise(exercise: PracticeExercise): boolean {
    if (!exercise.targetSkillType) {
      throw AppError.validation("Practice exercise must specify a target skill type.");
    }
    if (!exercise.learningObjective || exercise.learningObjective.trim().length === 0) {
      throw AppError.validation("Practice exercise must specify a clear learning objective.");
    }
    if (!exercise.promptText || exercise.promptText.trim().length === 0) {
      throw AppError.validation("Practice exercise prompt text cannot be empty.");
    }
    if (!exercise.expectedAnswer || exercise.expectedAnswer.trim().length === 0) {
      throw AppError.validation("Practice exercise expected answer cannot be empty.");
    }
    if (!exercise.selectionReason || exercise.selectionReason.trim().length === 0) {
      throw AppError.validation("Practice exercise selection reason must be present.");
    }
    return true;
  }
}

export const practiceExerciseGenerator = new PracticeExerciseGenerator();
