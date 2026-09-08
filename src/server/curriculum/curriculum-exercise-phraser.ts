import { modelRouter, ModelRouter } from "../providers/llm/router/model-router";
import { CurriculumActivity } from "@/domain/curriculum/daily-curriculum.schema";
import { LLMMessage } from "../providers/llm/llm-provider.interface";
import { logger } from "@/lib/logger/logger";

export interface PhrasedExerciseResult {
  activityId: string;
  targetSkill: string;
  activityType: string;
  difficulty: string;
  title: string;
  instructions: string;
  promptText: string;
  contextScenario?: string | undefined;
  expectedAnswerFormat?: string | undefined;
}

export class CurriculumExercisePhraser {
  constructor(private readonly router: ModelRouter = modelRouter) {}

  /**
   * Enforces LLM role separation: Takes a deterministically selected CurriculumActivity (WHAT to practice)
   * and uses the LLM router to generate engaging phrasing and scenario text (HOW to phrase it).
   */
  async phraseExercise(activity: CurriculumActivity): Promise<PhrasedExerciseResult> {
    const systemPrompt = `You are an expert English language exercise designer.
Your role is strictly to decide HOW an exercise is phrased and presented to the user.
You MUST adhere strictly to the target skill, difficulty level, and activity type determined by the curriculum engine.

EXERCISE SPECIFICATIONS:
- Target Skill: ${activity.targetSkill}
- Target Category: ${activity.targetCategory}
- Activity Type: ${activity.activityType}
- CEFR Level: ${activity.difficulty}
- Objectives: ${activity.objectives.join("; ")}
- Selection Reason: ${activity.reason.explanationText}

INSTRUCTIONS:
Return a JSON object containing:
- "title": A clear, engaging exercise title
- "instructions": Concise step-by-step instructions for the user
- "promptText": The exact question, sentence to transform, or speaking prompt
- "contextScenario": (Optional) Brief real-world context scenario
- "expectedAnswerFormat": (Optional) Format guideline for user response`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Generate the phrasing for this ${activity.activityType} exercise targeting '${activity.targetSkill}' at ${activity.difficulty} level.`,
      },
    ];

    try {
      const response = await this.router.generateCompletion(messages, {
        taskType: "lesson_generation",
        temperature: 0.7,
      });

      let parsed: {
        title?: string;
        instructions?: string;
        promptText?: string;
        contextScenario?: string;
        expectedAnswerFormat?: string;
      } = {};

      try {
        parsed = JSON.parse(response.content);
      } catch {
        // Fallback parsing if JSON wrapper is returned
        const match = response.content.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        }
      }

      const result: PhrasedExerciseResult = {
        activityId: activity.id,
        targetSkill: activity.targetSkill,
        activityType: activity.activityType,
        difficulty: activity.difficulty,
        title: parsed.title ?? `${activity.targetSkill} Practice`,
        instructions: parsed.instructions ?? `Complete the ${activity.activityType} exercise focusing on ${activity.targetSkill}.`,
        promptText: parsed.promptText ?? `Practice using ${activity.targetSkill} correctly in a sentence.`,
        contextScenario: parsed.contextScenario,
        expectedAnswerFormat: parsed.expectedAnswerFormat,
      };

      logger.info("Phrased curriculum exercise via LLM router", {
        activityId: activity.id,
        targetSkill: activity.targetSkill,
      });

      return result;
    } catch (error) {
      logger.warn("LLM phrasing failed for curriculum exercise; falling back to deterministic template", { activityId: activity.id }, error);
      return {
        activityId: activity.id,
        targetSkill: activity.targetSkill,
        activityType: activity.activityType,
        difficulty: activity.difficulty,
        title: `${activity.targetSkill} (${activity.difficulty})`,
        instructions: `Focus on ${activity.targetSkill}. Complete the exercise with natural ${activity.targetCategory} usage.`,
        promptText: `Please respond using ${activity.targetSkill} in context.`,
      };
    }
  }
}

export const curriculumExercisePhraser = new CurriculumExercisePhraser();
