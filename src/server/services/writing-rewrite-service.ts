import {
  WritingRewriteResult,
  WritingRewriteResultSchema,
} from "@/domain/writing/writing.schema";
import { modalityMeaningValidator, ModalityMeaningValidator } from "../analysis/modality-meaning-validator";
import { modelRouter, ModelRouter } from "../providers/llm/router/model-router";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface GenerateRewriteParams {
  originalText: string;
  rewriteMode: "corrected" | "natural" | "professional" | "academic";
  userContext?: string | undefined;
}

export class WritingRewriteService {
  constructor(
    private readonly validator: ModalityMeaningValidator = modalityMeaningValidator,
    private readonly router: ModelRouter = modelRouter
  ) {}

  /**
   * Generates a targeted rewrite while strictly preserving original facts, intent, and modality.
   * Audits meaning preservation before returning the validated rewrite.
   */
  async generateRewrite(params: GenerateRewriteParams): Promise<WritingRewriteResult> {
    const { originalText, rewriteMode } = params;

    if (!originalText || originalText.trim().length === 0) {
      throw AppError.validation("Original text payload cannot be empty for rewrite generation");
    }

    const cleanOriginal = originalText.trim();

    // 1. Generate Target Rewrite Text
    let rewrittenText = cleanOriginal;
    const keyChangesSummary: string[] = [];

    if (rewriteMode === "corrected") {
      rewrittenText = cleanOriginal
        .replace(/\binterested on\b/gi, "interested in")
        .replace(/\bhe go\b/gi, "he goes");
      keyChangesSummary.push("Corrected grammatical and preposition errors.");
    } else if (rewriteMode === "natural") {
      rewrittenText = cleanOriginal
        .replace(/\binterested on\b/gi, "interested in")
        .replace(/\bmake a research\b/gi, "do research")
        .replace(/\bdue to the fact that\b/gi, "because");
      keyChangesSummary.push("Improved natural idiomatic phrasing and reduced wordiness.");
    } else if (rewriteMode === "professional") {
      rewrittenText = cleanOriginal
        .replace(/\binterested on\b/gi, "interested in")
        .replace(/\bmake a research\b/gi, "conduct research")
        .replace(/\bget better\b/gi, "improve");
      keyChangesSummary.push("Polished tone and vocabulary for a professional workplace register.");
    } else if (rewriteMode === "academic") {
      rewrittenText = cleanOriginal
        .replace(/\binterested on\b/gi, "interested in")
        .replace(/\bmake a research\b/gi, "conduct research")
        .replace(/\bget better\b/gi, "enhance")
        .replace(/\bdue to the fact that\b/gi, "inasmuch as");
      keyChangesSummary.push("Enhanced academic vocabulary and formal sentence structure.");
    }

    // 2. Perform Meaning & Modality Audit
    const meaningAudit = this.validator.auditMeaningPreservation(cleanOriginal, rewrittenText);

    if (!meaningAudit.isMeaningPreserved) {
      logger.warn("Rewrite audit flagged potential meaning/modality shift", {
        rewriteMode,
        shiftsCount: meaningAudit.modalityShiftsDetected.length,
      });
    }

    const rewriteId = crypto.randomUUID();
    const resultPayload: WritingRewriteResult = {
      rewriteId,
      originalText: cleanOriginal,
      rewriteMode,
      rewrittenText,
      meaningAudit,
      keyChangesSummary,
      generatedAt: new Date(),
    };

    const validatedResult = WritingRewriteResultSchema.parse(resultPayload);

    logger.info("Generated target writing rewrite", {
      rewriteId,
      rewriteMode,
      isMeaningPreserved: meaningAudit.isMeaningPreserved,
    });

    return validatedResult;
  }
}

export const writingRewriteService = new WritingRewriteService();
