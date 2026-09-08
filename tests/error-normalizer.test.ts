import { describe, it, expect } from "vitest";
import { errorNormalizer } from "@/server/learning/error-normalizer";

describe("Error Normalizer Engine", () => {
  it("should map surface variations of preposition errors to the same normalized key signature", () => {
    const occ1 = errorNormalizer.normalizeError({
      category: "grammar",
      subcategory: "preposition",
      originalText: "I am interested on astronomy.",
      correctedText: "I am interested in astronomy.",
    });

    const occ2 = errorNormalizer.normalizeError({
      category: "grammar",
      subcategory: "preposition",
      originalText: "I am interested on physics.",
      correctedText: "I am interested in physics.",
    });

    expect(occ1.normalizedKey).toBe("grammar:preposition:interested_in");
    expect(occ2.normalizedKey).toBe("grammar:preposition:interested_in");
    expect(occ1.canonicalPattern).toBe("interested in");
  });

  it("should use explicit error definition code when provided", () => {
    const occ = errorNormalizer.normalizeError({
      category: "grammar",
      subcategory: "article",
      originalText: "She is teacher.",
      correctedText: "She is a teacher.",
      errorDefinitionCode: "ARTICLE_MISSING",
    });

    expect(occ.normalizedKey).toBe("grammar:article:article_missing");
  });
});
