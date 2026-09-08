import { WordTimestamp, PhonemeAlignment } from "@/domain/speech/pronunciation.schema";

export const FIXTURE_TIMESTAMPS_WITH_PAUSES: WordTimestamp[] = [
  { word: "I", startTimeMs: 100, endTimeMs: 300, confidence: 0.98 },
  { word: "am", startTimeMs: 350, endTimeMs: 500, confidence: 0.99 },
  { word: "practicing", startTimeMs: 550, endTimeMs: 1100, confidence: 0.95 },
  // 800ms pause here (1900 - 1100)
  { word: "my", startTimeMs: 1900, endTimeMs: 2100, confidence: 0.97 },
  { word: "English", startTimeMs: 2150, endTimeMs: 2600, confidence: 0.96 },
  // 1000ms pause here (3600 - 2600)
  { word: "speaking", startTimeMs: 3600, endTimeMs: 4100, confidence: 0.94 },
];

export const FIXTURE_TEXT_WITH_FILLERS = "Um I think uh actually we should go, you know, to the store.";

export const FIXTURE_TEXT_WITH_REPETITIONS = "I am going to to the market market and and buying apples.";

export const FIXTURE_PHONEME_ALIGNMENTS: PhonemeAlignment[] = [
  { targetPhoneme: "θ", spokenPhoneme: "θ", startTimeMs: 100, endTimeMs: 180, confidence: 0.9, errorType: "correct" },
  { targetPhoneme: "ɪ", spokenPhoneme: "ɪ", startTimeMs: 180, endTimeMs: 240, confidence: 0.92, errorType: "correct" },
  { targetPhoneme: "ŋ", spokenPhoneme: "ŋ", startTimeMs: 240, endTimeMs: 300, confidence: 0.88, errorType: "correct" },
  { targetPhoneme: "k", spokenPhoneme: "t", startTimeMs: 300, endTimeMs: 350, confidence: 0.75, errorType: "substitution" }, // error
];
