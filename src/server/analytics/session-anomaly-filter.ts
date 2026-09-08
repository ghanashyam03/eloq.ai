import { logger } from "@/lib/logger/logger";

export interface SessionDataSample {
  sessionId: string;
  wordCount: number;
  durationSeconds: number;
  transcript: string;
  isCancelled?: boolean;
  errorMessage?: string;
  createdAt: Date;
}

export interface AnomalyFilterResult<T extends SessionDataSample> {
  cleanSessions: T[];
  filteredCount: number;
  anomalyReasons: Array<{ sessionId: string; reason: string }>;
}

export class SessionAnomalyFilter {
  /**
   * Filters out corrupted, unusually short, or failed provider sessions from progress analytics calculation
   * without destroying raw database records.
   */
  public filterAnomalies<T extends SessionDataSample>(sessions: T[]): AnomalyFilterResult<T> {
    const cleanSessions: T[] = [];
    const anomalyReasons: Array<{ sessionId: string; reason: string }> = [];

    for (const session of sessions) {
      const text = session.transcript.trim();
      const words = text.match(/\b\w+\b/g) || [];
      const wordCount = session.wordCount || words.length;

      // 1. Check provider failure or cancellation
      if (session.isCancelled || session.errorMessage) {
        anomalyReasons.push({
          sessionId: session.sessionId,
          reason: `Provider failure or turn cancellation: ${session.errorMessage ?? "cancelled"}`,
        });
        continue;
      }

      // 2. Check for empty or corrupted transcript marker
      if (!text || text.includes("STT_FAILURE") || text.includes("PROVIDER_TIMEOUT")) {
        anomalyReasons.push({
          sessionId: session.sessionId,
          reason: "Corrupted transcript text or STT failure marker",
        });
        continue;
      }

      // 3. Check for suspiciously low word count or duration
      if (wordCount < 5 || (session.durationSeconds > 0 && session.durationSeconds < 3)) {
        anomalyReasons.push({
          sessionId: session.sessionId,
          reason: `Extremely short session (words: ${wordCount}, duration: ${session.durationSeconds}s)`,
        });
        continue;
      }

      // 4. Check for repeated identical transcript loop (e.g. "test test test test test")
      const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
      if (words.length >= 8 && uniqueWords.size <= 2) {
        anomalyReasons.push({
          sessionId: session.sessionId,
          reason: "Repeated identical string loop anomaly",
        });
        continue;
      }

      cleanSessions.push(session);
    }

    if (anomalyReasons.length > 0) {
      logger.info("Filtered anomalous sessions from progress analytics", {
        totalSessions: sessions.length,
        cleanCount: cleanSessions.length,
        filteredCount: anomalyReasons.length,
      });
    }

    return {
      cleanSessions,
      filteredCount: anomalyReasons.length,
      anomalyReasons,
    };
  }
}

export const sessionAnomalyFilter = new SessionAnomalyFilter();
