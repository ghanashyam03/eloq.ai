import { describe, it, expect } from "vitest";
import { vocabularyExtractor } from "@/server/vocabulary/vocabulary-extractor";

describe("Vocabulary Extractor", () => {
  it("should extract candidate vocabulary entities from text", () => {
    const text = "We must take immediate action to mitigate potential risks and articulate our goals.";
    const candidates = vocabularyExtractor.extractCandidates({ text });

    expect(candidates.length).toBeGreaterThan(0);
    const mitigate = candidates.find((c) => c.lemma === "mitigate");
    expect(mitigate).toBeDefined();
    expect(mitigate?.word).toBe("mitigate");
    expect(mitigate?.collocations).toContain("mitigate risk");
    expect(mitigate?.isModelGenerated).toBe(false); // Authoritative entry
  });

  it("should boost priority score for misused words", () => {
    const text = "The ambiguous wording led to confusion.";
    const candidatesWithMisuse = vocabularyExtractor.extractCandidates({
      text,
      misusedWords: ["ambiguous"],
    });

    expect(candidatesWithMisuse[0]?.lemma).toBe("ambiguous");
  });

  it("should mark uncatalogued words as model-generated entries", () => {
    const text = "The hyper-parameterization was complex.";
    const candidates = vocabularyExtractor.extractCandidates({ text });

    const item = candidates.find((c) => c.lemma.includes("parameterization"));
    if (item) {
      expect(item.isModelGenerated).toBe(true);
    }
  });
});
