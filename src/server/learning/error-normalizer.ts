import { ErrorSignature } from "@/domain/learning/weakness-engine.schema";

export interface NormalizationInput {
  category: string;
  subcategory: string;
  originalText: string;
  correctedText: string;
  explanation?: string;
  errorDefinitionCode?: string;
}

export class ErrorNormalizer {
  /**
   * Deterministically normalizes error occurrence details into a canonical ErrorSignature.
   * Maps surface variations (e.g. "interested on physics", "interested on math")
   * to a single canonical pattern key ("grammar:preposition:interested_in").
   */
  public normalizeError(input: NormalizationInput): ErrorSignature {
    const category = input.category.toLowerCase().trim();
    const subcategory = input.subcategory.toLowerCase().trim();

    // 1. If error definition code exists, use explicit code key
    if (input.errorDefinitionCode && input.errorDefinitionCode.trim().length > 0) {
      const codeKey = input.errorDefinitionCode.toLowerCase().trim();
      return {
        category,
        subcategory,
        canonicalPattern: input.correctedText.trim(),
        normalizedKey: `${category}:${subcategory}:${codeKey}`,
      };
    }

    // 2. Extract canonical pattern from corrected text / explanation
    const canonicalPattern = this.extractCanonicalPattern(input.originalText, input.correctedText);
    const patternSlug = canonicalPattern
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const normalizedKey = `${category}:${subcategory}:${patternSlug}`;

    return {
      category,
      subcategory,
      canonicalPattern,
      normalizedKey,
    };
  }

  private extractCanonicalPattern(original: string, corrected: string): string {
    const origLower = original.toLowerCase().trim();
    const corrLower = corrected.toLowerCase().trim();

    // Pattern matching for prepositions: "interested on ..." -> "interested in"
    if (origLower.includes("interested on") || corrLower.includes("interested in")) {
      return "interested in";
    }

    // Pattern matching for third person: "she go", "he write" -> "third_person_s"
    if (origLower.match(/\b(she|he|it)\s+\w+(?<!s)\b/)) {
      return "third_person_s";
    }

    // Fallback: Use cleaned corrected text snippet
    return corrLower.slice(0, 30);
  }
}

export const errorNormalizer = new ErrorNormalizer();
