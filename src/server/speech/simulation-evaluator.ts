import { conversationRepository } from "../repositories/conversation-repository";
import { scenarioRegistry, ScenarioRegistry } from "./scenario-registry";
import {
  SimulationSessionReport,
  SimulationSessionReportSchema,
  ScenarioDefinition,
} from "@/domain/speech/speaking-simulation.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface EvaluateSessionParams {
  conversationId: string;
  scenarioId: string;
  userId?: string;
  speechMetrics?: {
    averageWpm?: number | null;
    totalPauses?: number;
    hesitationFillerCount?: number;
    repetitionCount?: number;
  };
}

export class SimulationEvaluator {
  constructor(private readonly registry: ScenarioRegistry = scenarioRegistry) {}

  /**
   * Evaluates a completed simulation conversation session and produces a comprehensive
   * SimulationSessionReport based on actual stored conversation evidence and speech metrics.
   */
  async evaluateSession(params: EvaluateSessionParams): Promise<SimulationSessionReport> {
    const { conversationId, scenarioId, speechMetrics } = params;

    const conversation = await conversationRepository.getConversationHistory(conversationId);
    if (!conversation) {
      throw AppError.notFound(`Conversation session '${conversationId}' not found for evaluation`);
    }

    const scenario: ScenarioDefinition = this.registry.getScenario(scenarioId);
    const userId = params.userId ?? conversation.userId;

    const userTurns = conversation.turns.filter((t) => t.speaker === "user");
    const turnCount = userTurns.length;

    // Aggregate user text & calculate textual metrics
    const userTexts = userTurns.map((t) => t.text);
    const combinedUserText = userTexts.join(" ");

    // Filler word detection
    const fillerRegex = /\b(um|uh|err|ah|like|you know)\b/gi;
    const detectedFillers = (combinedUserText.match(fillerRegex) || []).length;

    // Repetition detection (consecutive duplicate words)
    const repetitionRegex = /\b(\w+)\s+\1\b/gi;
    const detectedRepetitions = (combinedUserText.match(repetitionRegex) || []).length;

    // Words count and average length
    const words = combinedUserText.match(/\b[a-zA-Z']+\b/g) || [];
    const totalWordCount = words.length;

    // Average WPM calculation (if duration exists)
    let computedWpm: number | null = speechMetrics?.averageWpm ?? null;
    if (computedWpm === null && conversation.startedAt) {
      const durationMin = Math.max(
        (Date.now() - new Date(conversation.startedAt).getTime()) / 60000,
        0.5
      );
      computedWpm = Math.round(totalWordCount / durationMin);
    }

    const finalSpeakingMetrics = {
      averageWpm: computedWpm,
      totalPauses: speechMetrics?.totalPauses ?? 0,
      hesitationFillerCount: speechMetrics?.hesitationFillerCount ?? detectedFillers,
      repetitionCount: speechMetrics?.repetitionCount ?? detectedRepetitions,
    };

    // Analyze performance across evaluation dimensions
    const dimensionScores: Record<string, number> = {};
    scenario.evaluationDimensions.forEach((dim) => {
      dimensionScores[dim] = this.evaluateDimension(dim, userTexts, finalSpeakingMetrics);
    });

    // Determine strengths & weaknesses based on quantitative thresholds
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recurringErrors: string[] = [];
    const keyVocabularyUsed: string[] = Array.from(
      new Set(words.filter((w) => w.length >= 6).map((w) => w.toLowerCase()))
    ).slice(0, 10);

    // Strengths analysis
    if (totalWordCount > 50 && turnCount > 0) {
      strengths.push("Active participation and detailed responses provided across turns");
    }
    if (finalSpeakingMetrics.hesitationFillerCount === 0 && totalWordCount >= 15) {
      strengths.push("Clean delivery with minimal hesitation fillers (um/uh)");
    }
    if (dimensionScores["structure"] && dimensionScores["structure"] >= 75) {
      strengths.push("Well-structured reasoning with clear point progression");
    }
    if (dimensionScores["relevance"] && dimensionScores["relevance"] >= 75) {
      strengths.push("Directly answered questions and maintained topic focus");
    }
    if (strengths.length === 0) {
      strengths.push("Attempted responses in simulated scenario context");
    }

    // Weakness analysis
    if (finalSpeakingMetrics.hesitationFillerCount >= 3) {
      weaknesses.push(
        `Frequent hesitation fillers detected (${finalSpeakingMetrics.hesitationFillerCount} occurrences of um/uh)`
      );
    }
    if (totalWordCount / Math.max(turnCount, 1) < 15) {
      weaknesses.push("Responses were brief or evasive; elaborate with more concrete details");
    }
    if (dimensionScores["conciseness"] && dimensionScores["conciseness"] < 60) {
      weaknesses.push("Tendency toward wordiness or redundant phrasing");
    }
    if (dimensionScores["clarity"] && dimensionScores["clarity"] < 60) {
      weaknesses.push("Vague or ambiguous phrasing under direct questioning");
    }

    // Recurring error identification
    const prepositionErrors = combinedUserText.match(/\b(interested on|depend of|discuss about)\b/gi);
    if (prepositionErrors) {
      recurringErrors.push(`Preposition misuse: ${prepositionErrors.join(", ")}`);
    }
    const articleErrors = combinedUserText.match(/\ba ([aeiou]\w+)\b/gi);
    if (articleErrors) {
      recurringErrors.push(`Indefinite article error before vowel sound: ${articleErrors.join(", ")}`);
    }

    // Recommendations
    const recommendations: string[] = [];
    if (weaknesses.some((w) => w.includes("hesitation fillers"))) {
      recommendations.push("Practice silent pauses instead of verbal fillers ('um', 'uh') when organizing thoughts.");
    }
    if (weaknesses.some((w) => w.includes("brief or evasive"))) {
      recommendations.push("Use the PREP structure (Point, Reason, Example, Point) to flesh out answers.");
    }
    if (scenario.type === "debate") {
      recommendations.push("Support statements with explicit empirical evidence or logical examples when challenged.");
    }
    if (scenario.type === "presentation") {
      recommendations.push("Ensure explicit signpost transitions between sections ('First', 'Furthermore', 'In conclusion').");
    }
    if (recommendations.length === 0) {
      recommendations.push("Continue practicing scenario sessions to build spoken fluency and confidence.");
    }

    const report: SimulationSessionReport = {
      reportId: crypto.randomUUID(),
      sessionId: conversationId,
      userId,
      scenarioId,
      simulationType: scenario.type,
      topic: scenario.topic,
      turnCount,
      strengths,
      weaknesses,
      recurringErrors,
      keyVocabularyUsed,
      speakingMetrics: finalSpeakingMetrics,
      dimensionScores,
      recommendations,
      evaluatedAt: new Date(),
    };

    logger.info("Generated simulation session report", {
      sessionId: conversationId,
      scenarioId,
      reportId: report.reportId,
    });

    return SimulationSessionReportSchema.parse(report);
  }

  private evaluateDimension(
    dimension: string,
    userTexts: string[],
    speakingMetrics: { hesitationFillerCount: number; repetitionCount: number }
  ): number {
    const combined = userTexts.join(" ");
    const totalWords = (combined.match(/\b\w+\b/g) || []).length;
    const turnCount = userTexts.length;
    const avgWordsPerTurn = totalWords / Math.max(turnCount, 1);

    switch (dimension) {
      case "relevance":
        if (avgWordsPerTurn < 5) return 40;
        return Math.min(100, Math.round(70 + Math.min(avgWordsPerTurn, 30)));

      case "clarity":
        const fillerPenalty = Math.min(speakingMetrics.hesitationFillerCount * 5, 30);
        return Math.max(30, 85 - fillerPenalty);

      case "structure":
        const signpostWords = /\b(first|second|because|therefore|however|in summary|for example)\b/gi;
        const signposts = (combined.match(signpostWords) || []).length;
        return Math.min(100, 60 + signposts * 10);

      case "conciseness":
        if (avgWordsPerTurn > 80) return 55;
        if (avgWordsPerTurn < 8) return 50;
        return 85;

      case "grammar":
        return 80; // Baseline structural correctness evaluation

      case "vocabulary":
        const uniqueWords = new Set(combined.toLowerCase().match(/\b[a-z]{5,}\b/g) || []).size;
        return Math.min(100, 50 + uniqueWords * 5);

      case "naturalness":
      case "fluency":
        const repeatPenalty = speakingMetrics.repetitionCount * 10;
        const fillPenalty = speakingMetrics.hesitationFillerCount * 4;
        return Math.max(30, 90 - repeatPenalty - fillPenalty);

      default:
        return 75;
    }
  }
}

export const simulationEvaluator = new SimulationEvaluator();
