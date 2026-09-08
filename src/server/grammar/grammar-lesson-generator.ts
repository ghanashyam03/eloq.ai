import {
  GrammarLesson,
  GrammarLessonSchema,
  PersonalizedExample,
  ContrastiveFocus,
  LessonExercise,
} from "@/domain/grammar/grammar-learning.schema";
import { grammarSkillRegistry, GrammarSkillRegistry } from "./grammar-skill-registry";
import { modelRouter, ModelRouter } from "../providers/llm/router/model-router";
import { logger } from "@/lib/logger/logger";

export interface GenerateLessonParams {
  userId: string;
  skillId: string;
  userHistoricMistakes?: {
    originalText: string;
    correctedText: string;
    explanation: string;
  }[] | undefined;
}

export class GrammarLessonGenerator {
  constructor(
    private readonly registry: GrammarSkillRegistry = grammarSkillRegistry,
    private readonly router: ModelRouter = modelRouter
  ) {}

  /**
   * Generates a targeted, validated grammar lesson with personalized user examples
   * and contrastive focus where applicable.
   */
  async generateLesson(params: GenerateLessonParams): Promise<GrammarLesson> {
    const skill = this.registry.getSkill(params.skillId);
    const contrastivePartner = this.registry.getContrastivePartner(params.skillId);

    // 1. Build Personalized User Examples
    const userPersonalizedExamples: PersonalizedExample[] = (params.userHistoricMistakes ?? []).map((m) => ({
      originalUtterance: m.originalText,
      correctedUtterance: m.correctedText,
      explanation: m.explanation,
      context: "Your recent conversation",
    }));

    // 2. Build Contrastive Focus if partner exists
    let contrastiveFocus: ContrastiveFocus | undefined;
    if (contrastivePartner) {
      contrastiveFocus = {
        conceptA: skill.name,
        conceptB: contrastivePartner.name,
        keyDifference: `${skill.name} focuses on completed/specific time, whereas ${contrastivePartner.name} connects past events to present relevance or unstated timeframes.`,
        exampleA: `I lived in London for two years (in 2018; finished).`,
        exampleB: `I have lived in London for two years (and still live there now).`,
      };
    }

    // 3. Generate Validated Lesson Content (Deterministic fallback or LLM generation)
    const lessonId = crypto.randomUUID();
    const controlledExercises: LessonExercise[] = [
      {
        id: "ex_ctrl_1",
        level: "recognition",
        prompt: `Select the correct sentence using ${skill.name}:`,
        options: [
          `I ${skill.id.includes("past") ? "visited" : "have visited"} Paris last summer.`,
          `I ${skill.id.includes("past") ? "have visited" : "visited"} Paris last summer.`,
        ],
        correctAnswer: `I ${skill.id.includes("past") ? "visited" : "have visited"} Paris last summer.`,
        explanation: "Specific past time markers require the simple past tense.",
        acceptableAlternatives: [],
      },
      {
        id: "ex_ctrl_2",
        level: "controlled_production",
        prompt: `Complete the sentence correctly: "She ____ (be) interested in astronomy since childhood."`,
        options: ["was", "has been", "is being"],
        correctAnswer: "has been",
        explanation: "The preposition 'since' indicates a timeframe starting in the past and continuing to the present.",
        acceptableAlternatives: ["has been"],
      },
    ];

    const productionExercise: LessonExercise = {
      id: "ex_prod_1",
      level: "guided_production",
      prompt: `Write a sentence about an experience you had, using the target structure correctly:`,
      correctAnswer: "I visited London in 2022.",
      explanation: "Ensure time markers match the chosen tense structure.",
      acceptableAlternatives: [
        "I have visited London three times.",
        "I visited New York last year.",
      ],
    };

    const speakingChallengePrompt = `In 2-3 sentences, describe a trip or accomplishment from your past. Pay special attention to using ${skill.name} correctly.`;

    const lessonPayload: GrammarLesson = {
      lessonId,
      skillId: skill.id,
      skillName: skill.name,
      objective: `Master the natural, correct usage of ${skill.name} in spontaneous conversation.`,
      explanation: `${skill.description}. Natural English uses this structure when referring to specific time frames or completed actions without artificial restrictions.`,
      contrastiveFocus,
      userPersonalizedExamples,
      generalExamples: [
        `Regular: She studied English yesterday.`,
        `Contrast: She has studied English for three years.`,
      ],
      controlledExercises,
      productionExercise,
      speakingChallengePrompt,
      createdAt: new Date(),
    };

    const validatedLesson = GrammarLessonSchema.parse(lessonPayload);

    logger.info("Generated validated grammar lesson", {
      lessonId,
      skillId: skill.id,
      hasContrastiveFocus: Boolean(contrastiveFocus),
      personalizedExamplesCount: userPersonalizedExamples.length,
    });

    return validatedLesson;
  }
}

export const grammarLessonGenerator = new GrammarLessonGenerator();
