import { z } from "zod";
import { modelRouter, ModelRouter } from "../providers/llm/router/model-router";
import { deterministicAnalyzer, DeterministicAnalyzer } from "../analysis/deterministic-analyzer";
import { issueVerifier, IssueVerifier } from "../analysis/verifier";
import { buildEnglishAnalysisPromptV1 } from "../prompts/english-analysis.v1";
import {
  StructuredLinguisticAnalysis,
  StructuredLinguisticAnalysisSchema,
  LinguisticIssue,
  ClassificationState,
} from "@/domain/analysis/analysis-engine.schema";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface AnalyzeEnglishParams {
  transcript: string;
  englishVariety?: string; // en-US, en-GB, en-AU
  userLevel?: string;
  topicContext?: string;
  providerOverride?: import("../providers/llm/registry/model-task.types").ProviderType;
  modelOverride?: string;
  disableFallback?: boolean;
  speechMetadata?: {
    durationSeconds?: number | null;
    pauseCount?: number | null;
    totalPauseSecs?: number | null;
  };
}

const rawLLMOutputSchema = z.object({
  overallSummary: z.string().default("Analysis completed."),
  isCompletelyCorrect: z.boolean().default(false),
  classificationState: z
    .enum([
      "grammatically_incorrect",
      "unnatural_phrase",
      "grammatically_correct_and_natural",
      "informal_valid",
      "dialect_variant_valid",
      "ambiguous_uncertain",
    ])
    .catch("grammatically_correct_and_natural"),
  issues: z
    .array(
      z.object({
        category: z
          .string()
          .transform((val) => val.toUpperCase())
          .pipe(z.enum(["GRAMMAR", "VOCABULARY", "NATURALNESS", "FLUENCY", "COHERENCE"]))
          .catch("GRAMMAR"),
        subcategory: z.string().default("general"),
        classificationState: z
          .enum([
            "grammatically_incorrect",
            "unnatural_phrase",
            "grammatically_correct_and_natural",
            "informal_valid",
            "dialect_variant_valid",
            "ambiguous_uncertain",
          ])
          .catch("grammatically_correct_and_natural"),
        originalText: z.string().default(""),
        correctedText: z.string().default(""),
        naturalAlternative: z.string().optional(),
        explanation: z.string().default("Linguistic observation"),
        severity: z.coerce.number().int().min(1).max(5).default(2),
        confidence: z.coerce.number().min(0.0).max(1.0).default(0.8),
        evidenceSpan: z
          .object({ textSnippet: z.string().default("") })
          .catch({ textSnippet: "" })
          .default({ textSnippet: "" }),
        uncertaintyState: z.boolean().default(false),
      })
    )
    .default([]),
  usefulVocabularyEncounters: z
    .array(
      z.object({
        word: z.string(),
        context: z.string().default(""),
        suggestedUpgrade: z.string().optional(),
      })
    )
    .default([]),
});

export class EnglishAnalysisService {
  constructor(
    private readonly router: ModelRouter = modelRouter,
    private readonly statsAnalyzer: DeterministicAnalyzer = deterministicAnalyzer,
    private readonly verifier: IssueVerifier = issueVerifier
  ) {}

  /**
   * Evaluates an English utterance with deterministic statistics, Pass 1 candidate detection,
   * Pass 2 conservative verification filtering, dynamic escalation, and confidence thresholding.
   */
  async analyzeEnglish(params: AnalyzeEnglishParams): Promise<StructuredLinguisticAnalysis> {
    const { transcript, englishVariety = "en-US", userLevel = "B2", topicContext, speechMetadata } = params;

    if (!transcript || transcript.trim().length === 0) {
      throw AppError.validation("Transcript cannot be empty for linguistic analysis");
    }

    const startTime = Date.now();

    // 1. Run Deterministic Analysis (No LLM wasted for statistics)
    const deterministicStats = this.statsAnalyzer.analyzeText(transcript, speechMetadata);

    // 2. Build Versioned Prompt Messages (englishAnalysis.v1)
    const messages = buildEnglishAnalysisPromptV1({
      transcript,
      englishVariety,
      userLevel,
      ...(topicContext ? { topicContext } : {}),
    });

    const routerOptions = {
      taskType: "grammar_analysis" as const,
      temperature: 0.2,
      ...(params.providerOverride ? { providerOverride: params.providerOverride } : {}),
      ...(params.modelOverride ? { modelOverride: params.modelOverride } : {}),
      ...(params.disableFallback ? { disableFallback: params.disableFallback } : {}),
    };

    const routingDecision = this.router.resolveRoutingDecision(routerOptions);

    // 3. Pass 1: LLM Candidate Issue Extraction via ModelRouter
    let rawResult;
    try {
      rawResult = await this.router.generateStructured(messages, rawLLMOutputSchema, routerOptions);
    } catch (error) {
      logger.error("Pass 1 candidate extraction failed", { transcript }, error);
      throw AppError.externalProvider("analysis", "Linguistic analysis candidate extraction failed", error);
    }

    // 4. Map candidate raw issues to full domain LinguisticIssue records
    let candidateIssues: LinguisticIssue[] = rawResult.issues.map((rawIssue) => ({
      id: crypto.randomUUID(),
      category: rawIssue.category,
      subcategory: rawIssue.subcategory as LinguisticIssue["subcategory"],
      classificationState: rawIssue.classificationState as ClassificationState,
      originalText: rawIssue.originalText,
      correctedText: rawIssue.correctedText,
      ...(rawIssue.naturalAlternative ? { naturalAlternative: rawIssue.naturalAlternative } : {}),
      explanation: rawIssue.explanation,
      severity: rawIssue.severity,
      confidence: rawIssue.confidence,
      evidenceSpan: {
        textSnippet: rawIssue.evidenceSpan.textSnippet,
        startIndex: Math.max(0, transcript.indexOf(rawIssue.originalText)),
        endIndex: Math.max(0, transcript.indexOf(rawIssue.originalText)) + rawIssue.originalText.length,
      },
      uncertaintyState: rawIssue.uncertaintyState,
    }));

    // 5. Pass 2: Conservative Verification Filtering
    let verificationResults = this.verifier.verifyIssues(candidateIssues, englishVariety);

    // 6. Check for Verifier Disagreement / High Contradiction on Non-Trusted Models & Trigger Escalation if allowed
    const hasDisagreement = verificationResults.some((res) => !res.isAccepted && res.certainty !== "dialect_variant" && res.certainty !== "informal_valid");
    const isSelectedTrusted = routingDecision.qualityStatus === "safe_for_primary";

    if (hasDisagreement && !isSelectedTrusted && routingDecision.escalationAllowed && !params.disableFallback && !params.providerOverride) {
      try {
        logger.warn("Verifier disagreement detected on acceptable candidate output. Triggering dynamic escalation to Gemini...", {
          taskType: routerOptions.taskType,
          originalModel: routingDecision.selectedRouterModel,
        });

        const escalatedRaw = await this.router.escalateStructured(
          messages,
          rawLLMOutputSchema,
          routerOptions,
          "Verifier disagreement on acceptable model candidate issues."
        );

        rawResult = escalatedRaw;
        candidateIssues = rawResult.issues.map((rawIssue) => ({
          id: crypto.randomUUID(),
          category: rawIssue.category,
          subcategory: rawIssue.subcategory as LinguisticIssue["subcategory"],
          classificationState: rawIssue.classificationState as ClassificationState,
          originalText: rawIssue.originalText,
          correctedText: rawIssue.correctedText,
          ...(rawIssue.naturalAlternative ? { naturalAlternative: rawIssue.naturalAlternative } : {}),
          explanation: rawIssue.explanation,
          severity: rawIssue.severity,
          confidence: rawIssue.confidence,
          evidenceSpan: {
            textSnippet: rawIssue.evidenceSpan.textSnippet,
            startIndex: Math.max(0, transcript.indexOf(rawIssue.originalText)),
            endIndex: Math.max(0, transcript.indexOf(rawIssue.originalText)) + rawIssue.originalText.length,
          },
          uncertaintyState: rawIssue.uncertaintyState,
        }));

        verificationResults = this.verifier.verifyIssues(candidateIssues, englishVariety);
      } catch (escalateErr) {
        logger.warn("Escalation attempt failed; proceeding with verifier-filtered original result", {
          error: escalateErr instanceof Error ? escalateErr.message : String(escalateErr),
        });
      }
    }

    const verifiedIssues: LinguisticIssue[] = [];
    const verificationReasons: string[] = [];

    for (const res of verificationResults) {
      verificationReasons.push(`${res.issue.originalText}: ${res.reason}`);
      if (res.isAccepted) {
        verifiedIssues.push(res.issue);
      }
    }

    // 7. Partition by Configurable Confidence Thresholds
    const highConfidenceIssues: LinguisticIssue[] = [];
    const mediumConfidenceIssues: LinguisticIssue[] = [];
    let filteredLowConfidenceCount = 0;

    for (const issue of verifiedIssues) {
      if (issue.confidence >= 0.85) {
        highConfidenceIssues.push(issue);
      } else if (issue.confidence >= 0.60) {
        mediumConfidenceIssues.push(issue);
      } else {
        filteredLowConfidenceCount++;
      }
    }

    const isCompletelyCorrect =
      rawResult.isCompletelyCorrect || (highConfidenceIssues.length === 0 && mediumConfidenceIssues.length === 0);

    const overallSummary = isCompletelyCorrect
      ? "No significant linguistic issues detected. Utterance is natural and clear."
      : rawResult.overallSummary;

    const finalResult: StructuredLinguisticAnalysis = {
      overallSummary,
      isCompletelyCorrect,
      classificationState: (isCompletelyCorrect
        ? "grammatically_correct_and_natural"
        : rawResult.classificationState) as ClassificationState,
      deterministicStats,
      highConfidenceIssues,
      mediumConfidenceIssues,
      filteredLowConfidenceCount,
      usefulVocabularyEncounters: rawResult.usefulVocabularyEncounters,
      rawModelResponse: JSON.stringify(rawResult),
      normalizedCandidateCount: candidateIssues.length,
      verificationReasons,
      analyzedAt: new Date(),
    };

    const validatedResult = StructuredLinguisticAnalysisSchema.parse(finalResult);

    logger.info("Linguistic analysis completed successfully", {
      transcriptLength: transcript.length,
      highConfidenceCount: highConfidenceIssues.length,
      mediumConfidenceCount: mediumConfidenceIssues.length,
      selectedProvider: routingDecision.selectedProvider,
      selectedModel: routingDecision.selectedRouterModel,
      latencyMs: Date.now() - startTime,
    });

    return validatedResult;
  }
}

export const englishAnalysisService = new EnglishAnalysisService();
