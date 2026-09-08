import {
  ModalityMeaningAudit,
  ModalityMeaningAuditSchema,
} from "@/domain/writing/writing.schema";

const MODAL_CERTAINTY_MAP: Record<string, "possibility" | "probability" | "certainty"> = {
  may: "possibility",
  might: "possibility",
  could: "possibility",
  can: "possibility",
  should: "probability",
  would: "probability",
  will: "certainty",
  must: "certainty",
  shall: "certainty",
};

export class ModalityMeaningValidator {
  /**
   * Audits a original vs rewritten sentence pair to detect unauthorized modality shifts or intent alterations.
   */
  public auditMeaningPreservation(
    originalText: string,
    rewrittenText: string
  ): ModalityMeaningAudit {
    const origLower = originalText.toLowerCase();
    const rewriteLower = rewrittenText.toLowerCase();

    const origWords = origLower.split(/\s+/).map((w) => w.replace(/[^a-z]/g, ""));
    const rewriteWords = rewriteLower.split(/\s+/).map((w) => w.replace(/[^a-z]/g, ""));

    const modalityShiftsDetected: { originalModal: string; rewriteModal: string; explanation: string }[] = [];

    // 1. Modal Verb Shift Detection
    Object.entries(MODAL_CERTAINTY_MAP).forEach(([modal, level]) => {
      if (origWords.includes(modal)) {
        // Check if modal was replaced by a higher certainty modal
        Object.entries(MODAL_CERTAINTY_MAP).forEach(([otherModal, otherLevel]) => {
          if (
            rewriteWords.includes(otherModal) &&
            !origWords.includes(otherModal) &&
            level === "possibility" &&
            otherLevel === "certainty"
          ) {
            modalityShiftsDetected.push({
              originalModal: modal,
              rewriteModal: otherModal,
              explanation: `Original text used possibility modal '${modal}', which was escalated to certainty modal '${otherModal}'.`,
            });
          }
        });
      }
    });

    // 2. Fact / Number Preservation Check
    const origNumbers = (originalText.match(/\b\d+\b/g) ?? []) as string[];
    const rewriteNumbers = (rewrittenText.match(/\b\d+\b/g) ?? []) as string[];
    const missingNumbers = origNumbers.filter((n) => !rewriteNumbers.includes(n));

    let factualDifferenceNote: string | undefined;
    if (missingNumbers.length > 0) {
      factualDifferenceNote = `Numerical facts (${missingNumbers.join(", ")}) were omitted or altered in the rewrite.`;
    }

    const isMeaningPreserved = modalityShiftsDetected.length === 0 && missingNumbers.length === 0;
    const confidenceScore = isMeaningPreserved ? 0.95 : 0.4;

    return ModalityMeaningAuditSchema.parse({
      isMeaningPreserved,
      confidenceScore,
      modalityShiftsDetected,
      ...(factualDifferenceNote ? { factualDifferenceNote } : {}),
    });
  }
}

export const modalityMeaningValidator = new ModalityMeaningValidator();
