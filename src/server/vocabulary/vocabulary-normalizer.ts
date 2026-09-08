/**
 * Vocabulary Normalizer
 * Provides string normalization, stopword filtering, and rule-based lemmatization for English vocabulary concepts.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "so", "than", "then", "as", "at", "by", "for",
  "in", "into", "of", "off", "on", "onto", "out", "over", "to", "up", "with", "from", "about",
  "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
  "did", "will", "would", "shall", "should", "may", "might", "can", "could", "must",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "this", "that", "these", "those",
  "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
  "not", "no", "yes", "very", "too", "also", "just", "now", "well"
]);

// Exact mappings for common irregular forms
const IRREGULAR_LEMMAS: Record<string, string> = {
  // Verbs
  running: "run",
  ran: "run",
  runs: "run",
  writing: "write",
  wrote: "write",
  written: "write",
  writes: "write",
  speaking: "speak",
  spoke: "speak",
  spoken: "speak",
  speaks: "speak",
  going: "go",
  went: "go",
  gone: "go",
  goes: "go",
  buying: "buy",
  bought: "buy",
  buys: "buy",
  making: "make",
  made: "make",
  makes: "make",
  taking: "take",
  took: "take",
  taken: "take",
  takes: "take",
  giving: "give",
  gave: "give",
  given: "give",
  gives: "give",
  thinking: "think",
  thought: "think",
  thinks: "think",
  mitigated: "mitigate",
  mitigating: "mitigate",
  mitigates: "mitigate",

  // Irregular nouns & adjectives
  better: "good",
  best: "good",
  worse: "bad",
  worst: "bad",
  children: "child",
  teeth: "tooth",
  feet: "foot",
  people: "person",
  mice: "mouse",
  studies: "study",
  studied: "study",
  studying: "study",
};

export class VocabularyNormalizer {
  /**
   * Normalizes a raw word string (lowercased, trimmed, punctuation stripped).
   */
  normalizeWord(word: string): string {
    if (!word) return "";
    return word
      .trim()
      .toLowerCase()
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
  }

  /**
   * Derives the base lemma of a word using dictionary lookup and suffix rules.
   */
  getLemma(rawWord: string): string {
    const normalized = this.normalizeWord(rawWord);
    if (!normalized) return "";

    // 1. Check irregular lookup
    if (IRREGULAR_LEMMAS[normalized]) {
      return IRREGULAR_LEMMAS[normalized];
    }

    // 2. Rule-based suffix stripping for standard English inflections
    if (normalized.endsWith("ies") && normalized.length > 4) {
      return normalized.slice(0, -3) + "y"; // e.g. "cities" -> "city"
    }

    if (normalized.endsWith("ing") && normalized.length > 5) {
      const base = normalized.slice(0, -3);
      if (base.endsWith("e")) return base;
      // e.g. "creating" -> "create"
      if (["creat", "allocat", "evaluat", "calculat", "mitigat"].includes(base)) {
        return base + "e";
      }
      return base;
    }

    if (normalized.endsWith("ed") && normalized.length > 4) {
      const base = normalized.slice(0, -2);
      if (["creat", "allocat", "evaluat", "calculat", "mitigat"].includes(base)) {
        return base + "e";
      }
      return base;
    }

    if (normalized.endsWith("es") && normalized.length > 4 && (normalized.endsWith("shes") || normalized.endsWith("ches") || normalized.endsWith("xes"))) {
      return normalized.slice(0, -2);
    }

    if (
      normalized.endsWith("s") &&
      !normalized.endsWith("ss") &&
      !normalized.endsWith("ous") &&
      !normalized.endsWith("us") &&
      !normalized.endsWith("is") &&
      normalized.length > 3
    ) {
      return normalized.slice(0, -1); // e.g. "books" -> "book"
    }

    return normalized;
  }

  /**
   * Determines if a word is a stopword or trivial noise.
   */
  isStopWord(word: string): boolean {
    const normalized = this.normalizeWord(word);
    return STOP_WORDS.has(normalized) || normalized.length <= 2;
  }

  /**
   * Tokenizes and extracts non-stopword normalized lemmas from a block of text.
   */
  extractLemmas(text: string): string[] {
    if (!text) return [];
    const tokens = text.split(/\s+/);
    const lemmas: string[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      const clean = this.normalizeWord(token);
      if (!clean || this.isStopWord(clean)) continue;

      const lemma = this.getLemma(clean);
      if (lemma && !seen.has(lemma)) {
        seen.add(lemma);
        lemmas.push(lemma);
      }
    }

    return lemmas;
  }
}

export const vocabularyNormalizer = new VocabularyNormalizer();
