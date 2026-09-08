import { GoldStandardTestCase } from "@/domain/evaluation/evaluation.schema";

export const goldStandardDataset: GoldStandardTestCase[] = [
  // 1. GRAMMAR - ARTICLES
  {
    id: "g-art-01",
    category: "grammar_article",
    input: "I bought a apple from the grocery store.",
    englishVariety: "en-US",
    expectedClassification: "grammatically_incorrect",
    expectedIssues: [
      {
        category: "GRAMMAR",
        subcategory: "article",
        originalTextSnippet: "a apple",
        acceptableCorrections: ["an apple"],
      },
    ],
    shouldBeCompletelyCorrect: false,
    difficulty: "A2",
  },
  {
    id: "g-art-02",
    category: "grammar_article",
    input: "She is architect working in San Francisco.",
    englishVariety: "en-US",
    expectedClassification: "grammatically_incorrect",
    expectedIssues: [
      {
        category: "GRAMMAR",
        subcategory: "article",
        originalTextSnippet: "is architect",
        acceptableCorrections: ["is an architect"],
      },
    ],
    shouldBeCompletelyCorrect: false,
    difficulty: "B1",
  },

  // 2. GRAMMAR - PREPOSITIONS
  {
    id: "g-prep-01",
    category: "grammar_preposition",
    input: "I am interested on astronomy and astrophysics.",
    englishVariety: "en-US",
    expectedClassification: "grammatically_incorrect",
    expectedIssues: [
      {
        category: "GRAMMAR",
        subcategory: "preposition",
        originalTextSnippet: "interested on",
        acceptableCorrections: ["interested in"],
      },
    ],
    shouldBeCompletelyCorrect: false,
    difficulty: "B1",
  },

  // 3. GRAMMAR - TENSES
  {
    id: "g-tense-01",
    category: "grammar_tense",
    input: "She go to market yesterday and buyed three apples.",
    englishVariety: "en-US",
    expectedClassification: "grammatically_incorrect",
    expectedIssues: [
      {
        category: "GRAMMAR",
        subcategory: "tense",
        originalTextSnippet: "go to market yesterday",
        acceptableCorrections: ["went to the market yesterday"],
      },
    ],
    shouldBeCompletelyCorrect: false,
    difficulty: "A2",
  },

  // 4. GRAMMAR - AGREEMENT
  {
    id: "g-agreed-01",
    category: "grammar_agreement",
    input: "He don't has no money for buying tickets.",
    englishVariety: "en-US",
    expectedClassification: "grammatically_incorrect",
    expectedIssues: [
      {
        category: "GRAMMAR",
        subcategory: "subject_verb_agreement",
        originalTextSnippet: "don't has",
        acceptableCorrections: ["doesn't have"],
      },
    ],
    shouldBeCompletelyCorrect: false,
    difficulty: "A2",
  },

  // 5. NATURALNESS - UNNATURAL PHRASE
  {
    id: "nat-unn-01",
    category: "naturalness_unnatural",
    input: "I am having a doubt about this specific topic.",
    englishVariety: "en-US",
    expectedClassification: "unnatural_phrase",
    expectedIssues: [
      {
        category: "NATURALNESS",
        subcategory: "awkward_phrase",
        originalTextSnippet: "having a doubt",
        acceptableCorrections: ["have a question", "am confused about"],
      },
    ],
    shouldBeCompletelyCorrect: false,
    difficulty: "B1",
  },

  // 6. VOCABULARY - COLLOCATION ERROR
  {
    id: "voc-col-01",
    category: "vocabulary_collocation",
    input: "We must mitigate about potential risks before launching.",
    englishVariety: "en-US",
    expectedClassification: "grammatically_incorrect",
    expectedIssues: [
      {
        category: "VOCABULARY",
        subcategory: "collocation",
        originalTextSnippet: "mitigate about",
        acceptableCorrections: ["mitigate", "mitigate against"],
      },
    ],
    shouldBeCompletelyCorrect: false,
    difficulty: "B2",
  },

  // 7. CLEARLY CORRECT SENTENCES (Zero False Positives Required)
  {
    id: "cor-01",
    category: "clearly_correct",
    input: "I went to the university yesterday and met my professor.",
    englishVariety: "en-US",
    expectedClassification: "grammatically_correct_and_natural",
    expectedIssues: [],
    shouldBeCompletelyCorrect: true,
    difficulty: "B1",
  },
  {
    id: "cor-02",
    category: "clearly_correct",
    input: "Trees help mitigate the impact of climate change by absorbing carbon.",
    englishVariety: "en-US",
    expectedClassification: "grammatically_correct_and_natural",
    expectedIssues: [],
    shouldBeCompletelyCorrect: true,
    difficulty: "B2",
  },
  {
    id: "cor-03",
    category: "clearly_correct",
    input: "Could you please clarify the primary objectives for this quarter's project?",
    englishVariety: "en-US",
    expectedClassification: "grammatically_correct_and_natural",
    expectedIssues: [],
    shouldBeCompletelyCorrect: true,
    difficulty: "B2",
  },

  // 8. INFORMAL VALID SPEECH (Must NOT be flagged as grammar error)
  {
    id: "inf-01",
    category: "naturalness_informal",
    input: "Gotta go now, catch ya later!",
    englishVariety: "en-US",
    expectedClassification: "informal_valid",
    expectedIssues: [],
    shouldBeCompletelyCorrect: true,
    difficulty: "A2",
  },

  // 9. DIALECT VARIANT
  {
    id: "dia-01",
    category: "dialect_variant",
    input: "I stayed at home at the weekend and cleaned my flat.",
    englishVariety: "en-GB",
    expectedClassification: "dialect_variant_valid",
    expectedIssues: [],
    shouldBeCompletelyCorrect: true,
    difficulty: "B1",
  },

  // 10. AMBIGUOUS SENTENCE
  {
    id: "amb-01",
    category: "ambiguous",
    input: "Visiting relatives can be annoying.",
    englishVariety: "en-US",
    expectedClassification: "ambiguous_context",
    expectedIssues: [],
    shouldBeCompletelyCorrect: true,
    difficulty: "C1",
  },
];
