import { WeaknessEvidenceItem } from "@/domain/learning/weakness-engine.schema";

export interface CandidateTarget {
  id: string;
  type: "error" | "grammar" | "vocabulary" | "speaking";
  category: string;
  title: string;
  normalizedKey: string;
  priorityScore: number; // 0 to 10
  goalMatchWeight: number; // 0 to 10
  srsUrgency: number; // 0 to 10
  failureRate: number; // 0 to 10
  daysSinceLastSeen: number;
  distinctSessions: number;
  occurrenceCount: number;
}

export interface PrioritizedCandidate extends CandidateTarget {
  expectedLearningValue: number;
  selectionReason: string;
}

export class PracticePrioritizer {
  /**
   * Deterministically calculates Expected Learning Value (ELV) and ranks candidates.
   */
  prioritizeCandidates(
    candidates: CandidateTarget[],
    topWeaknesses: WeaknessEvidenceItem[] = []
  ): PrioritizedCandidate[] {
    const weaknessMap = new Map(topWeaknesses.map((w) => [w.normalizedKey, w]));

    const scored = candidates.map((candidate) => {
      const weakness = weaknessMap.get(candidate.normalizedKey);
      const weaknessPriority = weakness?.priorityScore ?? candidate.priorityScore;

      // Recency factor: 10 if seen today, decaying smoothly over 30 days
      const recencyFactor = Math.max(0, 10 - candidate.daysSinceLastSeen * 0.3);

      // Expected Learning Value (ELV) formula:
      // ELV = (P_weakness * 0.35) + (W_goal * 0.25) + (U_srs * 0.20) + (FailureRate * 0.15) + (Recency * 0.05)
      const elvRaw =
        weaknessPriority * 0.35 +
        candidate.goalMatchWeight * 0.25 +
        candidate.srsUrgency * 0.20 +
        candidate.failureRate * 0.15 +
        recencyFactor * 0.05;

      const expectedLearningValue = parseFloat(elvRaw.toFixed(2));
      const selectionReason = this.generateSelectionReason(candidate, weaknessPriority);

      return {
        ...candidate,
        expectedLearningValue,
        selectionReason,
      };
    });

    // Sort by ELV descending
    return scored.sort((a, b) => b.expectedLearningValue - a.expectedLearningValue);
  }

  /**
   * Generates a transparent, evidence-backed selection reason explaining why this exercise was chosen.
   */
  private generateSelectionReason(candidate: CandidateTarget, weaknessPriority: number): string {
    if (candidate.srsUrgency >= 7.0) {
      return `Selected because ${candidate.title} is past its review schedule (Urgency: ${candidate.srsUrgency.toFixed(1)}) and requires active retrieval maintenance.`;
    }

    if (weaknessPriority >= 6.0) {
      return `Selected because ${candidate.category} '${candidate.title}' is currently a high-priority recurring weakness (Priority Score: ${weaknessPriority.toFixed(1)}, Sessions: ${candidate.distinctSessions}) and has not been mastered in spontaneous usage.`;
    }

    if (candidate.goalMatchWeight >= 7.0) {
      return `Selected because '${candidate.title}' directly aligns with your active user learning goal and current target proficiency level.`;
    }

    if (candidate.failureRate >= 5.0) {
      return `Selected because recent practice attempts on '${candidate.title}' showed high error rates (${(candidate.failureRate * 10).toFixed(0)}% failures), requiring targeted reinforcement.`;
    }

    return `Selected to broaden context coverage and reinforce '${candidate.title}' in practical usage.`;
  }
}

export const practicePrioritizer = new PracticePrioritizer();
