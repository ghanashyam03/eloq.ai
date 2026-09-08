import { LLMMessage } from "../providers/llm/llm-provider.interface";

export const ANALYSIS_PROMPT_VERSION = "englishAnalysis.v1";

export interface AnalysisPromptOptions {
  transcript: string;
  englishVariety?: string; // en-US, en-GB, en-AU
  userLevel?: string;
  topicContext?: string;
}

/**
 * Builds versioned system and user prompt messages for structured linguistic analysis (v1).
 */
export function buildEnglishAnalysisPromptV1(
  options: AnalysisPromptOptions
): readonly LLMMessage[] {
  const variety = options.englishVariety ?? "en-US";
  const level = options.userLevel ?? "B2";

  const systemContent = `You are a world-class English linguistic analysis engine. Your primary purpose is to accurately evaluate user English utterances and identify genuine linguistic issues while strictly minimizing false positives.

SYSTEM PARAMETERS:
- Version: ${ANALYSIS_PROMPT_VERSION}
- Target Variety: ${variety}
- User CEFR Level: ${level}
${options.topicContext ? `- Topic Context: ${options.topicContext}` : ""}

CRITICAL ERROR CLASSIFICATION DIRECTIVES:
1. MINIMIZE FALSE POSITIVES: Accuracy is paramount. If you are uncertain whether a phrase is genuinely incorrect, DO NOT flag it. A completely valid or natural sentence MUST return "isCompletelyCorrect": true and an empty issues list.
2. SEPARATE GRAMMAR FROM NATURALNESS:
   - "grammatically_incorrect": Factual syntax or morphological rule breakdown (e.g. "She go yesterday").
   - "unnatural_phrase": Grammatically valid syntax but non-idiomatic phrasing (e.g. "I am having a doubt" -> preferred "I have a question"). DO NOT misclassify naturalness as grammar errors.
   - "informal_valid": Valid conversational English (e.g. "Gotta run", "gonna", "catch ya later"). Do NOT flag informal speech as a grammar error.
   - "dialect_variant_valid": Valid regional variations (e.g. British "flat", "colour", "at the weekend" vs. American "apartment", "color", "on the weekend"). Respect the target variety (${variety}).
3. EXACT EVIDENCE SPANS: For every issue identified, provide the exact character snippet ("textSnippet") and original text. Never fabricate corrections without identifying the exact text snippet being corrected.
4. ASSIGN CONFIDENCE (0.0 to 1.0): Assign realistic confidence scores. Assign < 0.60 if there is any ambiguity.
5. NO INVENTED RULES: Never invent non-existent grammar rules or force artificial complexity.

REQUIRED JSON RESPONSE SCHEMA:
{
  "overallSummary": "Brief linguistic evaluation summary",
  "isCompletelyCorrect": true | false,
  "classificationState": "grammatically_incorrect" | "unnatural_phrase" | "grammatically_correct_and_natural" | "informal_valid" | "dialect_variant_valid" | "ambiguous_uncertain",
  "issues": [
    {
      "id": "uuid-v4",
      "category": "GRAMMAR" | "VOCABULARY" | "NATURALNESS" | "FLUENCY" | "COHERENCE",
      "subcategory": "tense" | "article" | "preposition" | "subject_verb_agreement" | "awkward_phrase" | "misuse" | ...,
      "classificationState": "grammatically_incorrect" | "unnatural_phrase" | ...,
      "originalText": "exact original phrase",
      "correctedText": "corrected version",
      "naturalAlternative": "more natural alternative if applicable",
      "explanation": "concise explanation of the rule or natural usage",
      "severity": 1 to 5,
      "confidence": 0.0 to 1.0,
      "evidenceSpan": { "textSnippet": "exact original phrase" },
      "uncertaintyState": false
    }
  ],
  "usefulVocabularyEncounters": [
    { "word": "example", "context": "usage context", "suggestedUpgrade": "optional upgrade" }
  ]
}`;

  const userContent = `<UTTERANCE_TO_ANALYZE>\n${options.transcript}\n</UTTERANCE_TO_ANALYZE>`;

  return Object.freeze([
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ]);
}
