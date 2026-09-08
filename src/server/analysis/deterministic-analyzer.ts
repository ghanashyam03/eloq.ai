import { DeterministicStats } from "@/domain/analysis/analysis-engine.schema";

const KNOWN_FILLER_TOKENS = new Set([
  "uh",
  "um",
  "er",
  "err",
  "ah",
  "hmm",
  "like",
  "you know",
  "i mean",
  "basically",
  "actually",
]);

export class DeterministicAnalyzer {
  /**
   * Calculates exact word counts, sentence counts, vocabulary diversity (TTR),
   * and filler occurrences purely deterministically.
   */
  public analyzeText(
    text: string,
    speechMetadata?: { durationSeconds?: number | null; pauseCount?: number | null; totalPauseSecs?: number | null }
  ): DeterministicStats {
    if (!text || text.trim().length === 0) {
      return {
        wordCount: 0,
        sentenceCount: 0,
        typeTokenRatio: 0,
        fillerCount: 0,
        detectedFillers: [],
        wordsPerMinute: null,
        pauseCount: null,
        totalPauseDurationSecs: null,
      };
    }

    const normalizedText = text.trim();
    const words = normalizedText
      .toLowerCase()
      .replace(/[^\w\s']/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const wordCount = words.length;

    // Sentence count based on terminal punctuation (. ! ?)
    const sentences = normalizedText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const sentenceCount = Math.max(1, sentences.length);

    // Type-Token Ratio (Unique words / Total words)
    const uniqueWords = new Set(words);
    const typeTokenRatio = wordCount > 0 ? parseFloat((uniqueWords.size / wordCount).toFixed(2)) : 0;

    // Filler token extraction
    const detectedFillers: string[] = [];
    const lowerText = normalizedText.toLowerCase();

    for (const token of KNOWN_FILLER_TOKENS) {
      if (token.includes(" ")) {
        // Multi-word filler like "you know"
        const regex = new RegExp(`\\b${token}\\b`, "gi");
        const matches = lowerText.match(regex);
        if (matches) {
          for (let i = 0; i < matches.length; i++) {
            detectedFillers.push(token);
          }
        }
      } else {
        // Single word filler like "uh", "um"
        for (const w of words) {
          if (w === token) {
            detectedFillers.push(token);
          }
        }
      }
    }

    // WPM calculation from speech duration if available
    let wordsPerMinute: number | null = null;
    if (speechMetadata?.durationSeconds && speechMetadata.durationSeconds > 0) {
      wordsPerMinute = Math.round((wordCount / speechMetadata.durationSeconds) * 60);
    }

    return {
      wordCount,
      sentenceCount,
      typeTokenRatio,
      fillerCount: detectedFillers.length,
      detectedFillers,
      wordsPerMinute,
      pauseCount: speechMetadata?.pauseCount ?? null,
      totalPauseDurationSecs: speechMetadata?.totalPauseSecs ?? null,
    };
  }
}

export const deterministicAnalyzer = new DeterministicAnalyzer();
