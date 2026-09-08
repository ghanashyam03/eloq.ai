import {
  WordTimestamp,
  PauseMetrics,
  FillerMetrics,
  FillerItem,
  RepetitionMetrics,
  RepetitionItem,
  PitchMetrics,
  RawFluencyProfile,
} from "@/domain/speech/pronunciation.schema";

const HESITATION_PATTERNS = new Set(["uh", "um", "er", "ah", "hmm", "eh"]);
const DISCOURSE_MARKER_PATTERNS = ["you know", "actually", "i mean", "basically", "so", "well", "like"];

export interface BuildFluencyProfileParams {
  transcript: string;
  timestamps?: WordTimestamp[] | undefined;
  explicitSpeakingDurationMs?: number | undefined;
  totalDurationMs?: number | undefined;
  pitchHzValues?: number[] | undefined;
}

export class FluencyAnalyzer {
  /**
   * Calculates WPM strictly from word count and active speaking duration.
   * Ignores initial silence before speech began.
   */
  public calculateSpeechRate(
    wordCount: number,
    timestamps?: WordTimestamp[] | undefined,
    explicitSpeakingDurationMs?: number | undefined
  ): { wpm: number | null; status: "AVAILABLE" | "NOT_AVAILABLE"; speakingDurationMs: number | null } {
    if (timestamps && timestamps.length >= 2) {
      const first = timestamps[0];
      const last = timestamps[timestamps.length - 1];
      if (first && last) {
        const activeStart = first.startTimeMs;
        const activeEnd = last.endTimeMs;
        const activeDurationMs = activeEnd - activeStart;

        if (activeDurationMs > 0) {
          const wpm = Math.round((wordCount / (activeDurationMs / 60000)) * 10) / 10;
          return { wpm, status: "AVAILABLE", speakingDurationMs: activeDurationMs };
        }
      }
    }

    if (explicitSpeakingDurationMs && explicitSpeakingDurationMs > 0 && wordCount > 0) {
      const wpm = Math.round((wordCount / (explicitSpeakingDurationMs / 60000)) * 10) / 10;
      return { wpm, status: "AVAILABLE", speakingDurationMs: explicitSpeakingDurationMs };
    }

    return { wpm: null, status: "NOT_AVAILABLE", speakingDurationMs: null };
  }

  /**
   * Calculates pause metrics strictly from gaps between consecutive word timestamps.
   * Pause threshold defaults to 350ms gap.
   */
  public calculatePauseMetrics(
    timestamps?: WordTimestamp[] | undefined,
    pauseThresholdMs = 350
  ): PauseMetrics {
    if (!timestamps || timestamps.length < 2) {
      return { status: "NOT_AVAILABLE" };
    }

    const gapsMs: number[] = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      const curr = timestamps[i];
      const next = timestamps[i + 1];
      if (curr && next) {
        const gap = next.startTimeMs - curr.endTimeMs;
        if (gap >= pauseThresholdMs) {
          gapsMs.push(gap);
        }
      }
    }

    if (gapsMs.length === 0) {
      return {
        status: "AVAILABLE",
        pauseCount: 0,
        totalPauseDurationMs: 0,
        averagePauseDurationMs: 0,
        longestPauseDurationMs: 0,
        gapsMs: [],
      };
    }

    const totalPauseMs = gapsMs.reduce((acc, val) => acc + val, 0);
    const avgPauseMs = Math.round(totalPauseMs / gapsMs.length);
    const maxPauseMs = Math.max(...gapsMs);

    return {
      status: "AVAILABLE",
      pauseCount: gapsMs.length,
      totalPauseDurationMs: totalPauseMs,
      averagePauseDurationMs: avgPauseMs,
      longestPauseDurationMs: maxPauseMs,
      gapsMs,
    };
  }

  /**
   * Categorizes fillers conservatively, separating hesitation sounds (uh, um) from discourse markers.
   */
  public analyzeFillers(transcript: string, timestamps?: WordTimestamp[] | undefined): FillerMetrics {
    const textLower = transcript.toLowerCase();
    const words = textLower.split(/\s+/).filter(Boolean);

    const items: FillerItem[] = [];
    let hesitationCount = 0;
    let discourseMarkerCount = 0;

    // 1. Check hesitation sounds (uh, um, er, ah, etc.)
    words.forEach((w, idx) => {
      const cleanWord = w.replace(/[^a-z]/g, "");
      if (HESITATION_PATTERNS.has(cleanWord)) {
        hesitationCount++;
        const ts = timestamps?.[idx];
        items.push({
          text: cleanWord,
          type: "hesitation_filler",
          ...(ts ? { startTimeMs: ts.startTimeMs, endTimeMs: ts.endTimeMs } : {}),
          isProblematic: true,
          contextExplanation: `Hesitation vocalization '${cleanWord}' interrupts natural fluency.`,
        });
      }
    });

    // 2. Check discourse markers (you know, actually, I mean, etc.)
    DISCOURSE_MARKER_PATTERNS.forEach((marker) => {
      const regex = new RegExp(`\\b${marker}\\b`, "gi");
      const matches = [...transcript.matchAll(regex)];
      if (matches.length > 0) {
        discourseMarkerCount += matches.length;
        const isExcessive = matches.length > 2; // Only problematic if repeated excessively
        items.push({
          text: marker,
          type: "discourse_marker",
          isProblematic: isExcessive,
          contextExplanation: isExcessive
            ? `Discourse marker '${marker}' used ${matches.length} times, which may sound overly repetitive.`
            : `Natural conversational discourse marker '${marker}'.`,
        });
      }
    });

    return {
      hesitationCount,
      discourseMarkerCount,
      items,
    };
  }

  /**
   * Detects repeated words, repeated phrases, self-repairs, and abandoned sentences.
   */
  public analyzeRepetitions(transcript: string): RepetitionMetrics {
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    const items: RepetitionItem[] = [];
    let excessiveCount = 0;

    // 1. Word repetition detection (e.g. "the the")
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i];
      const word2 = words[i + 1];
      if (!word1 || !word2) continue;

      const w1 = word1.toLowerCase().replace(/[^a-z]/g, "");
      const w2 = word2.toLowerCase().replace(/[^a-z]/g, "");

      if (w1 && w1 === w2 && !["that", "had"].includes(w1)) {
        const isExcessive = true;
        if (isExcessive) excessiveCount++;
        items.push({
          repeatedText: `${word1} ${word2}`,
          type: "repeated_word",
          isExcessive,
          explanation: `Word '${word1}' was repeated consecutively.`,
        });
      }
    }

    // 2. Phrase repetition detection (e.g. "in the in the")
    for (let i = 0; i < words.length - 3; i++) {
      const w0 = words[i];
      const w1 = words[i + 1];
      const w2 = words[i + 2];
      const w3 = words[i + 3];
      if (!w0 || !w1 || !w2 || !w3) continue;

      const p1 = `${w0} ${w1}`.toLowerCase().replace(/[^a-z ]/g, "");
      const p2 = `${w2} ${w3}`.toLowerCase().replace(/[^a-z ]/g, "");

      if (p1 && p1 === p2) {
        excessiveCount++;
        items.push({
          repeatedText: `${w0} ${w1} ${w2} ${w3}`,
          type: "repeated_phrase",
          isExcessive: true,
          explanation: `Phrase '${p1}' was repeated.`,
        });
      }
    }

    // 3. Self-repair & trailing sentence detection (e.g., em-dashes or sudden shifts)
    if (transcript.includes("—") || transcript.includes("--") || /\b(i mean|no wait|sorry|rather)\b/i.test(transcript)) {
      items.push({
        repeatedText: "Self-repair marker",
        type: "self_repair",
        isExcessive: false,
        explanation: "Speaker corrected their phrasing mid-utterance.",
      });
    }

    return {
      totalRepetitions: items.length,
      excessiveCount,
      items,
    };
  }

  /**
   * Evaluates raw pitch metrics if provider pitch data is present.
   */
  public analyzePitch(pitchHzValues?: number[] | undefined): PitchMetrics {
    if (!pitchHzValues || pitchHzValues.length === 0) {
      return { status: "NOT_AVAILABLE" };
    }

    const validPitches = pitchHzValues.filter((p) => p > 50 && p < 500);
    if (validPitches.length === 0) {
      return { status: "NOT_AVAILABLE" };
    }

    const meanPitchHz = Math.round(validPitches.reduce((a, b) => a + b, 0) / validPitches.length);
    const minPitchHz = Math.min(...validPitches);
    const maxPitchHz = Math.max(...validPitches);

    // Standard deviation for intonation variation
    const variance = validPitches.reduce((acc, val) => acc + Math.pow(val - meanPitchHz, 2), 0) / validPitches.length;
    const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

    return {
      status: "AVAILABLE",
      meanPitchHz,
      minPitchHz,
      maxPitchHz,
      pitchVariationStdDev: stdDev,
      note: "Raw fundamental frequency (F0) pitch metrics extracted from audio provider.",
    };
  }

  /**
   * Assembles full RawFluencyProfile without premature magic score collapsing.
   */
  public buildFluencyProfile(params: BuildFluencyProfileParams): RawFluencyProfile {
    const words = params.transcript.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    const rateResult = this.calculateSpeechRate(wordCount, params.timestamps, params.explicitSpeakingDurationMs);
    const pauseResult = this.calculatePauseMetrics(params.timestamps);
    const fillerResult = this.analyzeFillers(params.transcript, params.timestamps);
    const repetitionResult = this.analyzeRepetitions(params.transcript);
    const pitchResult = this.analyzePitch(params.pitchHzValues);

    return {
      wordsPerMinute: rateResult.wpm,
      speechRateStatus: rateResult.status,
      speakingDurationMs: rateResult.speakingDurationMs,
      totalDurationMs: params.totalDurationMs ?? null,
      pauses: pauseResult,
      fillers: fillerResult,
      repetitions: repetitionResult,
      pitch: pitchResult,
      analyzedAt: new Date(),
    };
  }
}

export const fluencyAnalyzer = new FluencyAnalyzer();
