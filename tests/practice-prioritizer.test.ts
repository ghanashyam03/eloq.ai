import { describe, it, expect } from "vitest";
import { practicePrioritizer, CandidateTarget } from "@/server/practice/practice-prioritizer";
import { WeaknessEvidenceItem } from "@/domain/learning/weakness-engine.schema";

const VALID_UUID = "12345678-1234-4234-8234-123456789abc";

describe("Practice Prioritizer Engine", () => {
  const sampleWeaknesses: WeaknessEvidenceItem[] = [
    {
      id: VALID_UUID,
      normalizedKey: "grammar:preposition:interested_in",
      title: "PREPOSITION: interested in",
      description: "Incorrect preposition usage",
      category: "grammar",
      subcategory: "preposition",
      occurrenceCount: 5,
      distinctSessionCount: 3,
      firstDetectedAt: new Date("2026-08-01"),
      lastDetectedAt: new Date("2026-09-01"),
      averageSeverity: 3.5,
      averageConfidence: 0.95,
      priorityScore: 8.5,
      masteryEstimate: 0.2,
      trend: "worsening",
      status: "active",
      contextDistribution: { speaking: 5, writing: 0, conversation: 5, exercise: 0 },
      sampleExamples: [],
    },
  ];

  const candidateTargets: CandidateTarget[] = [
    {
      id: "c-1",
      type: "error",
      category: "preposition",
      title: "Prepositions after Adjectives",
      normalizedKey: "grammar:preposition:interested_in",
      priorityScore: 8.5,
      goalMatchWeight: 8.0,
      srsUrgency: 3.0,
      failureRate: 6.0,
      daysSinceLastSeen: 2,
      distinctSessions: 3,
      occurrenceCount: 5,
    },
    {
      id: "c-2",
      type: "vocabulary",
      category: "vocabulary",
      title: "Vocabulary: mitigate",
      normalizedKey: "vocabulary:mitigate",
      priorityScore: 4.0,
      goalMatchWeight: 5.0,
      srsUrgency: 2.0,
      failureRate: 2.0,
      daysSinceLastSeen: 10,
      distinctSessions: 1,
      occurrenceCount: 2,
    },
  ];

  it("should calculate Expected Learning Value (ELV) and sort candidate targets descending", () => {
    const prioritized = practicePrioritizer.prioritizeCandidates(candidateTargets, sampleWeaknesses);

    expect(prioritized.length).toBe(2);
    expect(prioritized[0]?.id).toBe("c-1");
    expect(prioritized[0]?.expectedLearningValue).toBeGreaterThan(prioritized[1]!.expectedLearningValue);
  });

  it("should generate a transparent, evidence-backed selection reason for top weakness candidate", () => {
    const prioritized = practicePrioritizer.prioritizeCandidates(candidateTargets, sampleWeaknesses);
    const top = prioritized[0]!;

    expect(top.selectionReason).toContain("high-priority recurring weakness");
    expect(top.selectionReason).toContain("Priority Score: 8.5");
  });

  it("should emphasize SRS urgency in selection reason when review is overdue", () => {
    const overdueCandidate: CandidateTarget[] = [
      {
        id: "c-overdue",
        type: "vocabulary",
        category: "vocabulary",
        title: "Vocabulary: articulate",
        normalizedKey: "vocabulary:articulate",
        priorityScore: 5.0,
        goalMatchWeight: 6.0,
        srsUrgency: 9.0,
        failureRate: 3.0,
        daysSinceLastSeen: 5,
        distinctSessions: 2,
        occurrenceCount: 3,
      },
    ];

    const prioritized = practicePrioritizer.prioritizeCandidates(overdueCandidate, []);
    expect(prioritized[0]?.selectionReason).toContain("past its review schedule");
    expect(prioritized[0]?.selectionReason).toContain("Urgency: 9.0");
  });
});
