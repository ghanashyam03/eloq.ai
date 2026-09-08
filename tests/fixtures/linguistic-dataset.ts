export interface EvaluationTestCase {
  id: string;
  category: "clearly_incorrect" | "clearly_correct" | "unnatural_phrase" | "informal_valid" | "dialect_variant" | "filler_count";
  input: string;
  englishVariety?: string;
  expectedClassification: string;
  expectedMinIssues?: number;
  expectedMaxIssues?: number;
  shouldBeCompletelyCorrect?: boolean;
}

export const linguisticDataset: EvaluationTestCase[] = [
  // 1. Clearly Incorrect Sentences
  {
    id: "err-01",
    category: "clearly_incorrect",
    input: "She go to market yesterday and buyed three apple.",
    expectedClassification: "grammatically_incorrect",
    expectedMinIssues: 1,
    shouldBeCompletelyCorrect: false,
  },
  {
    id: "err-02",
    category: "clearly_incorrect",
    input: "He don't has no money for buy ticket.",
    expectedClassification: "grammatically_incorrect",
    expectedMinIssues: 1,
    shouldBeCompletelyCorrect: false,
  },

  // 2. Clearly Correct Sentences (ZERO False Positives Allowed)
  {
    id: "cor-01",
    category: "clearly_correct",
    input: "I went to the university yesterday and met my professor.",
    expectedClassification: "grammatically_correct_and_natural",
    expectedMinIssues: 0,
    expectedMaxIssues: 0,
    shouldBeCompletelyCorrect: true,
  },
  {
    id: "cor-02",
    category: "clearly_correct",
    input: "Could you please clarify the main objectives of this quarter's project?",
    expectedClassification: "grammatically_correct_and_natural",
    expectedMinIssues: 0,
    expectedMaxIssues: 0,
    shouldBeCompletelyCorrect: true,
  },

  // 3. Unnatural Phrasing (Grammatically Acceptable but Non-Idiomatic)
  {
    id: "unn-01",
    category: "unnatural_phrase",
    input: "I am having a doubt about this topic.",
    expectedClassification: "unnatural_phrase",
    expectedMinIssues: 1,
    shouldBeCompletelyCorrect: false,
  },

  // 4. Informal but Valid Speech (Must NOT be flagged as grammar error)
  {
    id: "inf-01",
    category: "informal_valid",
    input: "Gotta go now, catch ya later!",
    expectedClassification: "informal_valid",
    expectedMaxIssues: 0,
    shouldBeCompletelyCorrect: true,
  },

  // 5. Dialect Variant Differences (British vs American)
  {
    id: "dia-01",
    category: "dialect_variant",
    input: "I stayed at home at the weekend and cleaned my flat.",
    englishVariety: "en-GB",
    expectedClassification: "dialect_variant_valid",
    expectedMaxIssues: 0,
    shouldBeCompletelyCorrect: true,
  },
];
