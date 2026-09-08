import { vocabularyNormalizer } from "./vocabulary-normalizer";
import { VocabularyEntity } from "@/domain/vocabulary/vocabulary.schema";

export interface VocabularyExtractionRequest {
  text: string;
  userLevel?: string | undefined; // A1, A2, B1, B2, C1, C2
  userGoals?: string[] | undefined; // academic, professional, conversational
  misusedWords?: string[] | undefined;
}

// Seeded curated dictionary of high-value English vocabulary with collocations & IPA
const LEXICAL_DICTIONARY: Record<string, Partial<VocabularyEntity>> = {
  mitigate: {
    word: "mitigate",
    lemma: "mitigate",
    partOfSpeech: "verb",
    definition: "To make something less harmful, serious, or severe.",
    pronunciation: "MIT-i-gate",
    ipa: "/ˈmɪt.ə.ɡeɪt/",
    register: "academic",
    difficulty: "B2",
    collocations: ["mitigate risk", "mitigate damage", "mitigate the impact", "mitigate losses"],
    synonyms: ["alleviate", "reduce", "lessen", "diminish"],
    antonyms: ["exacerbate", "aggravate", "intensify"],
    exampleSentences: [
      "We must take immediate action to mitigate potential risks.",
      "Trees help mitigate the impact of climate change by absorbing carbon.",
    ],
    isModelGenerated: false,
  },
  articulate: {
    word: "articulate",
    lemma: "articulate",
    partOfSpeech: "verb",
    definition: "To express an idea or feeling fluently and coherently.",
    pronunciation: "ar-TIC-yoo-late",
    ipa: "/ɑːrˈtɪk.jə.leɪt/",
    register: "academic",
    difficulty: "B2",
    collocations: ["articulate clearly", "articulate a vision", "articulate thoughts"],
    synonyms: ["express", "convey", "voice", "enunciate"],
    antonyms: ["mumble", "misrepresent"],
    exampleSentences: [
      "She was able to articulate her thoughts clearly during the presentation.",
    ],
    isModelGenerated: false,
  },
  ambiguous: {
    word: "ambiguous",
    lemma: "ambiguous",
    partOfSpeech: "adjective",
    definition: "Open to more than one interpretation; not having one obvious meaning.",
    pronunciation: "am-BIG-yoo-us",
    ipa: "/æmˈbɪɡ.ju.əs/",
    register: "academic",
    difficulty: "C1",
    collocations: ["ambiguous statement", "highly ambiguous", "ambiguous wording"],
    synonyms: ["equivocal", "unclear", "vague", "doubtful"],
    antonyms: ["clear", "unambiguous", "explicit"],
    exampleSentences: [
      "The contract's instructions were ambiguous and led to confusion.",
    ],
    isModelGenerated: false,
  },
  subservient: {
    word: "subservient",
    lemma: "subservient",
    partOfSpeech: "adjective",
    definition: "Prepared to obey others unquestioningly; less important.",
    pronunciation: "sub-SER-vee-ent",
    ipa: "/səbˈsɜːr.vi.ənt/",
    register: "formal",
    difficulty: "C1",
    collocations: ["subservient role", "subservient to"],
    synonyms: ["subordinate", "servile", "compliant"],
    antonyms: ["dominant", "independent"],
    exampleSentences: [
      "Individual interests were made subservient to the common good.",
    ],
    isModelGenerated: false,
  },
  substantive: {
    word: "substantive",
    lemma: "substantive",
    partOfSpeech: "adjective",
    definition: "Having a firm basis in reality; important, meaningful, or considerable.",
    pronunciation: "SUB-stan-tive",
    ipa: "/ˈsʌb.stən.tɪv/",
    register: "academic",
    difficulty: "B2",
    collocations: ["substantive change", "substantive discussion", "substantive evidence"],
    synonyms: ["significant", "essential", "material", "substantial"],
    antonyms: ["trivial", "superficial"],
    exampleSentences: [
      "The meeting yielded substantive progress toward a resolution.",
    ],
    isModelGenerated: false,
  },
};

export class VocabularyExtractor {
  /**
   * Extracts high-value candidate vocabulary entities from user text or learning material.
   */
  extractCandidates(req: VocabularyExtractionRequest): VocabularyEntity[] {
    const text = req.text ?? "";
    const lemmas = vocabularyNormalizer.extractLemmas(text);
    const lemmaFrequencies = new Map<string, number>();

    for (const lemma of lemmas) {
      lemmaFrequencies.set(lemma, (lemmaFrequencies.get(lemma) ?? 0) + 1);
    }

    const misusedSet = new Set((req.misusedWords ?? []).map((w) => vocabularyNormalizer.getLemma(w)));
    const scoredCandidates: Array<{ lemma: string; score: number }> = [];

    for (const [lemma, freq] of lemmaFrequencies.entries()) {
      let score = freq * 1.0;

      // Misused word boost
      if (misusedSet.has(lemma)) {
        score += 5.0;
      }

      // Check if present in curated high-value dictionary
      if (LEXICAL_DICTIONARY[lemma]) {
        score += 3.0;
      }

      // Length heuristic (longer non-stop words usually carry higher lexical specificity)
      if (lemma.length >= 7) {
        score += 1.5;
      }

      scoredCandidates.push({ lemma, score });
    }

    // Sort by priority score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Build enriched VocabularyEntity array for top candidates
    const results: VocabularyEntity[] = [];

    for (const item of scoredCandidates.slice(0, 10)) {
      const lemma = item.lemma;
      const dictEntry = LEXICAL_DICTIONARY[lemma];

      if (dictEntry) {
        results.push({
          id: crypto.randomUUID(),
          word: dictEntry.word ?? lemma,
          lemma,
          partOfSpeech: dictEntry.partOfSpeech ?? "noun",
          definition: dictEntry.definition ?? `The concept or state of ${lemma}.`,
          pronunciation: dictEntry.pronunciation,
          ipa: dictEntry.ipa,
          register: dictEntry.register ?? "neutral",
          difficulty: dictEntry.difficulty ?? "intermediate",
          collocations: dictEntry.collocations ?? [`use ${lemma}`, `key ${lemma}`],
          synonyms: dictEntry.synonyms ?? [],
          antonyms: dictEntry.antonyms ?? [],
          exampleSentences: dictEntry.exampleSentences ?? [`Understanding ${lemma} improves communication clarity.`],
          isModelGenerated: dictEntry.isModelGenerated ?? false,
        });
      } else {
        // Model-generated fallback entry for uncatalogued words
        results.push({
          id: crypto.randomUUID(),
          word: lemma,
          lemma,
          partOfSpeech: "noun",
          definition: `Contextual vocabulary term '${lemma}'.`,
          register: "neutral",
          difficulty: "intermediate",
          collocations: [`apply ${lemma}`, `in terms of ${lemma}`],
          synonyms: [],
          antonyms: [],
          exampleSentences: [`The word '${lemma}' was extracted from recent practice context.`],
          isModelGenerated: true,
        });
      }
    }

    return results;
  }
}

export const vocabularyExtractor = new VocabularyExtractor();
