import { weaknessCalculator } from "../learning/weakness-calculator";
import { srsScheduler } from "../vocabulary/srs-scheduler";
import { UserVocabularyState } from "@/domain/vocabulary/vocabulary.schema";

export interface ScenarioTestResult {
  scenarioName: string;
  passed: boolean;
  details: string;
}

export class ScenarioEvaluator {
  /**
   * Deterministically evaluates adaptive engine behavior across lifecycle scenarios.
   */
  evaluateAdaptiveScenarios(): ScenarioTestResult[] {
    const results: ScenarioTestResult[] = [];

    // Scenario 1: Failure Escalation
    const priorityInitial = weaknessCalculator.calculatePriorityScore({
      occurrenceCount: 1,
      distinctSessionCount: 1,
      averageSeverity: 3,
      averageConfidence: 0.9,
      lastDetectedAt: new Date(),
    });

    const priorityRepeatedFailures = weaknessCalculator.calculatePriorityScore({
      occurrenceCount: 6,
      distinctSessionCount: 4,
      averageSeverity: 3.5,
      averageConfidence: 0.95,
      lastDetectedAt: new Date(),
      trend: "worsening",
    });

    const passedEscalation = priorityRepeatedFailures > priorityInitial;
    results.push({
      scenarioName: "Failure Escalation",
      passed: passedEscalation,
      details: `Priority score increased from ${priorityInitial} to ${priorityRepeatedFailures} upon repeated failures.`,
    });

    // Scenario 2: Mastery Progression & Priority Reduction
    const initialMastery = weaknessCalculator.calculateMastery({
      totalAttempts: 5,
      successes: 1,
      failures: 4,
    });

    const improvedMastery = weaknessCalculator.calculateMastery({
      totalAttempts: 10,
      successes: 8,
      failures: 2,
    });

    const passedMastery = improvedMastery > initialMastery;
    results.push({
      scenarioName: "Mastery Progression",
      passed: passedMastery,
      details: `Mastery estimate increased from ${initialMastery} to ${improvedMastery} after successful demonstrations.`,
    });

    // Scenario 3: Relapse State Transition
    const relapsedStatus = weaknessCalculator.evaluateStatus(0.4, 6, true);
    const passedRelapse = relapsedStatus === "relapsed";
    results.push({
      scenarioName: "Relapse State Transition",
      passed: passedRelapse,
      details: `Status correctly transitioned to 'relapsed' when user failed previously mastered skill.`,
    });

    // Scenario 4: SRS Active Interval Scaling
    const baseState: UserVocabularyState = {
      id: "12345678-1234-4234-8234-123456789abc",
      userId: "12345678-1234-4234-8234-123456789abc",
      vocabularyItemId: "12345678-1234-4234-8234-123456789abc",
      encounteredCount: 3,
      recognizedCount: 1,
      recalledCount: 0,
      producedCount: 2,
      correctProductionCount: 2,
      incorrectProductionCount: 0,
      naturalUsageCount: 0,
      timesMisused: 0,
      srsIntervalDays: 1,
      easeFactor: 2.5,
      consecutiveSuccesses: 1,
      mastery: 0.5,
      confidence: 0.5,
      status: "passive",
      lastSeenAt: new Date(),
      lastReviewedAt: null,
      nextReviewAt: null,
    };

    const srsResult = srsScheduler.calculateNextSchedule(baseState, "contextual_production", "correct_natural");
    const passedSRS = srsResult.nextIntervalDays >= 5 && srsResult.newStatus === "active";
    results.push({
      scenarioName: "SRS Production Escalation",
      passed: passedSRS,
      details: `SRS interval expanded to ${srsResult.nextIntervalDays} days and transitioned status to 'active' upon natural production.`,
    });

    return results;
  }
}

export const scenarioEvaluator = new ScenarioEvaluator();
