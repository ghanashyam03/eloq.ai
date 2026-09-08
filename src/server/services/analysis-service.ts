import { LLMProvider } from "../providers/llm/llm-provider.interface";
import { executeAIPipeline } from "../providers/ai-pipeline";
import { LinguisticAnalysisResult, LinguisticAnalysisResultSchema } from "@/domain/analysis/analysis.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export class AnalysisService {
  constructor(private readonly llmProvider: LLMProvider) {}

  /**
   * Analyzes an utterance transcript by calling the LLM provider and passing the output
   * through the strict Zod validation pipeline.
   */
  async analyzeTranscript(
    utteranceId: string,
    transcript: string
  ): Promise<LinguisticAnalysisResult> {
    if (!transcript || transcript.trim().length === 0) {
      throw AppError.validation("Transcript cannot be empty for analysis");
    }

    const systemPrompt = `You are a strict linguistic analysis engine. Analyze the provided English transcript for fluency, grammar, and vocabulary errors. Return a JSON object matching the requested schema.`;

    const response = await this.llmProvider.generateCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      { responseFormat: "json_object" }
    );

    // Enforce AI output pipeline validation
    const analysisResult = await executeAIPipeline(response.content, {
      providerName: this.llmProvider.providerName,
      operationName: "analyzeTranscript",
      schema: LinguisticAnalysisResultSchema,
    });

    logger.info("Transcript analysis completed successfully", {
      utteranceId,
      operation: "analyzeTranscript",
      provider: this.llmProvider.providerName,
    });

    return analysisResult;
  }
}
