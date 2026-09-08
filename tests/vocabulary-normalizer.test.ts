import { describe, it, expect } from "vitest";
import { vocabularyNormalizer } from "@/server/vocabulary/vocabulary-normalizer";

describe("Vocabulary Normalizer", () => {
  it("should normalize raw strings by lowercasing and stripping punctuation", () => {
    expect(vocabularyNormalizer.normalizeWord("  Mitigate! ")).toBe("mitigate");
    expect(vocabularyNormalizer.normalizeWord('"Ambiguous,"')).toBe("ambiguous");
    expect(vocabularyNormalizer.normalizeWord("running...")).toBe("running");
  });

  it("should map irregular words to canonical lemmas", () => {
    expect(vocabularyNormalizer.getLemma("running")).toBe("run");
    expect(vocabularyNormalizer.getLemma("ran")).toBe("run");
    expect(vocabularyNormalizer.getLemma("better")).toBe("good");
    expect(vocabularyNormalizer.getLemma("studies")).toBe("study");
    expect(vocabularyNormalizer.getLemma("children")).toBe("child");
  });

  it("should apply rule-based suffix stripping for standard English inflections", () => {
    expect(vocabularyNormalizer.getLemma("cities")).toBe("city");
    expect(vocabularyNormalizer.getLemma("mitigated")).toBe("mitigate");
    expect(vocabularyNormalizer.getLemma("mitigating")).toBe("mitigate");
    expect(vocabularyNormalizer.getLemma("books")).toBe("book");
  });

  it("should correctly identify stopwords and short noise", () => {
    expect(vocabularyNormalizer.isStopWord("the")).toBe(true);
    expect(vocabularyNormalizer.isStopWord("and")).toBe(true);
    expect(vocabularyNormalizer.isStopWord("is")).toBe(true);
    expect(vocabularyNormalizer.isStopWord("at")).toBe(true);
    expect(vocabularyNormalizer.isStopWord("mitigate")).toBe(false);
  });

  it("should tokenize text and extract unique non-stopword lemmas", () => {
    const text = "The team ran fast to mitigate the risks and studies the data.";
    const lemmas = vocabularyNormalizer.extractLemmas(text);

    expect(lemmas).toContain("team");
    expect(lemmas).toContain("run");
    expect(lemmas).toContain("fast");
    expect(lemmas).toContain("mitigate");
    expect(lemmas).toContain("risk");
    expect(lemmas).toContain("study");
    expect(lemmas).toContain("data");
    expect(lemmas).not.toContain("the");
    expect(lemmas).not.toContain("and");
  });
});
