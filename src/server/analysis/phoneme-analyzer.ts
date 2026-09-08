import {
  PhonemeAlignment,
  PhonemeAnalysisResult,
  SpeechAnalysisCapabilities,
} from "@/domain/speech/pronunciation.schema";

export class PhonemeAnalyzer {
  /**
   * Analyzes phoneme alignments if supported by an audio-capable speech provider.
   * Returns status = "NOT_AVAILABLE" without fabricating scores when alignment is absent.
   */
  public analyzePhonemes(
    capabilities: SpeechAnalysisCapabilities,
    alignments?: PhonemeAlignment[]
  ): PhonemeAnalysisResult {
    // 1. Check provider capabilities & alignment availability
    if (!capabilities.supportsPhonemeAlignment || !alignments || alignments.length === 0) {
      return {
        status: "NOT_AVAILABLE",
        phonemeAccuracyScore: null,
        totalPhonemesEvaluated: 0,
        alignments: [],
        problemPhonemes: [],
        confidence: 0.0,
        note: "Phoneme alignment data is unavailable from the current speech provider. Accuracy score was not fabricated.",
      };
    }

    // 2. Process real audio phoneme evidence
    const totalCount = alignments.length;
    let correctCount = 0;
    const problemMap = new Map<string, number>();

    alignments.forEach((item) => {
      if (item.errorType === "correct" || item.targetPhoneme === item.spokenPhoneme) {
        correctCount++;
      } else {
        const key = item.targetPhoneme;
        problemMap.set(key, (problemMap.get(key) ?? 0) + 1);
      }
    });

    const accuracyScore = Math.round((correctCount / totalCount) * 100) / 100;
    const problemPhonemes = Array.from(problemMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([phoneme]) => phoneme);

    const averageConfidence =
      Math.round((alignments.reduce((acc, val) => acc + val.confidence, 0) / totalCount) * 100) / 100;

    return {
      status: "AVAILABLE",
      phonemeAccuracyScore: accuracyScore,
      totalPhonemesEvaluated: totalCount,
      alignments,
      problemPhonemes,
      confidence: averageConfidence,
      note: `Analyzed ${totalCount} phoneme segments from audio evidence.`,
    };
  }
}

export const phonemeAnalyzer = new PhonemeAnalyzer();
