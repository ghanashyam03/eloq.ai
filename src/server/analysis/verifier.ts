import { LinguisticIssue, ClassificationState } from "@/domain/analysis/analysis-engine.schema";
import { logger } from "@/lib/logger/logger";

export type CorrectionCertainty =
  | "certain_error"
  | "probable_error"
  | "possible_issue"
  | "style_preference"
  | "dialect_variant"
  | "informal_valid"
  | "uncertain";

export interface VerificationResult {
  issue: LinguisticIssue;
  isAccepted: boolean;
  certainty: CorrectionCertainty;
  reason: string;
}

export class IssueVerifier {
  private readonly validSpokenFillersAndPhrases = new Set([
    "um",
    "uh",
    "er",
    "ah",
    "like",
    "you know",
    "well",
    "gonna",
    "wanna",
    "gotta",
    "kinda",
    "sorta",
    "head out",
    "catch ya later",
    "how's it going",
    "long time no see",
    "sounds good",
  ]);

  private readonly dialectSpellingPairs: Record<string, string> = {
    colour: "color",
    color: "colour",
    organised: "organized",
    organized: "organised",
    favour: "favor",
    favor: "favour",
    flavour: "flavor",
    flavor: "flavour",
    centre: "center",
    center: "centre",
    theatre: "theater",
    theater: "theatre",
    grey: "gray",
    gray: "grey",
    honour: "honor",
    honor: "honour",
    realise: "realize",
    realize: "realise",
    travelling: "traveling",
    traveling: "travelling",
    defence: "defense",
    defense: "defence",
    licence: "license",
    license: "licence",
  };

  /**
   * Pass 2 Conservative Verification filtering out false positives,
   * protecting against LLM hallucinations, enforcing dialect safety,
   * and classifying correction certainty.
   */
  public verifyIssues(
    candidateIssues: readonly LinguisticIssue[],
    targetVariety: string = "en-US"
  ): readonly VerificationResult[] {
    const results: VerificationResult[] = [];

    for (const issue of candidateIssues) {
      const verification = this.verifySingleIssue(issue, targetVariety);
      results.push(verification);

      if (!verification.isAccepted) {
        logger.info("Pass 2 verifier rejected candidate issue", {
          originalText: issue.originalText,
          category: issue.category,
          certainty: verification.certainty,
          reason: verification.reason,
        });
      }
    }

    return Object.freeze(results);
  }

  public verifySingleIssue(issue: LinguisticIssue, _targetVariety: string = "en-US"): VerificationResult {
    const originalTrimmed = issue.originalText.toLowerCase().trim();

    // 1. Evidence span existence check
    if (!issue.originalText || issue.originalText.trim().length === 0) {
      return {
        issue,
        isAccepted: false,
        certainty: "uncertain",
        reason: "Missing original evidence text span",
      };
    }

    // 2. Dialect variant protection
    if (this.dialectSpellingPairs[originalTrimmed]) {
      const reclassifiedIssue: LinguisticIssue = {
        ...issue,
        classificationState: "dialect_variant_valid" as ClassificationState,
        confidence: Math.min(issue.confidence, 0.95),
      };

      return {
        issue: reclassifiedIssue,
        isAccepted: false, // Rejected from grammar error queue; safe dialect variant
        certainty: "dialect_variant",
        reason: `Valid dialect spelling variant (${issue.originalText})`,
      };
    }

    // 3. Spoken language filler & informal register protection
    if (this.validSpokenFillersAndPhrases.has(originalTrimmed)) {
      if (issue.category === "GRAMMAR" || issue.classificationState === "grammatically_incorrect") {
        const reclassifiedIssue: LinguisticIssue = {
          ...issue,
          classificationState: "informal_valid" as ClassificationState,
          confidence: 0.95,
        };

        return {
          issue: reclassifiedIssue,
          isAccepted: false, // Rejected as grammar error; valid spoken informal register
          certainty: "informal_valid",
          reason: `Valid spoken informal phrase or filler word (${issue.originalText})`,
        };
      }
    }

    // 4. Low-confidence model judgment check
    if (issue.confidence < 0.65) {
      const uncertainIssue: LinguisticIssue = {
        ...issue,
        classificationState: "ambiguous_uncertain" as ClassificationState,
      };

      return {
        issue: uncertainIssue,
        isAccepted: false,
        certainty: "uncertain",
        reason: `Model confidence (${issue.confidence}) below strict verification threshold (0.65)`,
      };
    }

    // 5. Stylistic Preference vs Certain Error Detection
    let certainty: CorrectionCertainty = "probable_error";

    // High-certainty grammar patterns
    const certainGrammarPatterns = [
      /don't like/i,
      /he go/i,
      /she go/i,
      /have went/i,
      /has went/i,
      /interested on/i,
      /depends of/i,
      /good in playing/i,
      /since three years/i,
      /an european/i,
      /by the bus/i,
      /items are/i,
      /where is the/i,
      /would have known/i,
    ];

    const matchesCertainPattern = certainGrammarPatterns.some((pattern) => pattern.test(issue.originalText));

    if (matchesCertainPattern && issue.category === "GRAMMAR") {
      certainty = "certain_error";
    } else if (issue.category === "NATURALNESS" || issue.classificationState === "unnatural_phrase") {
      certainty = "style_preference";
    }

    // 6. Final Acceptance Decision:
    // Accept certain_error, probable_error, and style_preference issues with confidence >= 0.60
    const isAccepted =
      (certainty === "certain_error" || certainty === "probable_error" || certainty === "style_preference") &&
      issue.confidence >= 0.60;

    return {
      issue,
      isAccepted,
      certainty,
      reason: isAccepted
        ? `Verified as ${certainty} with confidence ${issue.confidence}`
        : `Filtered out as ${certainty}`,
    };
  }
}

export const issueVerifier = new IssueVerifier();
