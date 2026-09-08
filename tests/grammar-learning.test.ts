import { describe, it, expect, beforeEach } from "vitest";
import { GrammarSkillRegistry } from "@/server/grammar/grammar-skill-registry";
import { GrammarMasteryEngine } from "@/server/grammar/grammar-mastery-engine";
import { GrammarLessonGenerator } from "@/server/grammar/grammar-lesson-generator";
import { GrammarLearningService } from "@/server/services/grammar-learning-service";

const VALID_UUID_USER = "12345678-1234-4234-8234-123456789abc";

describe("Adaptive Grammar-Learning Subsystem", () => {
  let registry: GrammarSkillRegistry;
  let masteryEngine: GrammarMasteryEngine;
  let lessonGenerator: GrammarLessonGenerator;
  let service: GrammarLearningService;

  beforeEach(() => {
    registry = new GrammarSkillRegistry();
    masteryEngine = new GrammarMasteryEngine();
    lessonGenerator = new GrammarLessonGenerator(registry);
    service = new GrammarLearningService(registry, masteryEngine, lessonGenerator);
  });

  describe("1. Grammar Skill Hierarchy", () => {
    it("should support parent-child navigation and ancestor path traversal", () => {
      const pastSimple = registry.getSkill("tense_simple_past");
      expect(pastSimple.parentId).toBe("cat_tenses");

      const parent = registry.getParentSkill("tense_simple_past");
      expect(parent?.id).toBe("cat_tenses");

      const children = registry.getChildSkills("cat_tenses");
      expect(children.map((c) => c.id)).toContain("tense_simple_past");
      expect(children.map((c) => c.id)).toContain("tense_present_perfect");

      const ancestors = registry.getAncestorPath("tense_simple_past");
      expect(ancestors.map((a) => a.id)).toEqual(["grammar_root", "cat_tenses", "tense_simple_past"]);
    });

    it("should look up skills by subcategory and contrastive partner", () => {
      const found = registry.findSkillBySubcategory("article");
      expect(found?.id).toBe("art_definite");

      const partner = registry.getContrastivePartner("tense_simple_past");
      expect(partner?.id).toBe("tense_present_perfect");
    });
  });

  describe("2. Evidence Hierarchy & Weighted Mastery", () => {
    it("should weigh spontaneous production higher than controlled recognition", () => {
      const initialRecognition = masteryEngine.createInitialMastery(VALID_UUID_USER, "tense_simple_past");
      const initialSpontaneous = masteryEngine.createInitialMastery(VALID_UUID_USER, "tense_simple_past");

      const updatedRecognition = masteryEngine.updateMasteryState(initialRecognition, {
        isCorrect: true,
        evidenceLevel: "recognition",
      });

      const updatedSpontaneous = masteryEngine.updateMasteryState(initialSpontaneous, {
        isCorrect: true,
        evidenceLevel: "spontaneous_production",
      });

      expect(updatedSpontaneous.masteryScore).toBeGreaterThan(updatedRecognition.masteryScore);
      expect(updatedSpontaneous.weightedEvidenceScore).toBeGreaterThan(updatedRecognition.weightedEvidenceScore);
    });

    it("should cap mastery from controlled-only attempts until spontaneous production is demonstrated", () => {
      let state = masteryEngine.createInitialMastery(VALID_UUID_USER, "tense_simple_past");

      // 10 correct controlled attempts
      for (let i = 0; i < 10; i++) {
        state = masteryEngine.updateMasteryState(state, {
          isCorrect: true,
          evidenceLevel: "controlled_production",
        });
      }

      expect(state.masteryScore).toBeLessThanOrEqual(0.65);
      expect(state.successfulOpenAttempts).toBe(0);

      // Now 1 spontaneous attempt unlocks higher mastery
      state = masteryEngine.updateMasteryState(state, {
        isCorrect: true,
        evidenceLevel: "spontaneous_production",
      });

      expect(state.masteryScore).toBeGreaterThan(0.65);
    });
  });

  describe("3. Relapse Tracking & Spaced Review (SRS)", () => {
    it("should transition from mastered to relapse upon spontaneous error", () => {
      const state = masteryEngine.createInitialMastery(VALID_UUID_USER, "tense_simple_past");

      // Reach mastered state with 10-day review interval
      state.masteryScore = 0.88;
      state.successfulOpenAttempts = 3;
      state.relapseState = "mastered";
      state.srsIntervalDays = 10;

      // Spontaneous failure occurs
      const relapsedState = masteryEngine.updateMasteryState(state, {
        isCorrect: false,
        evidenceLevel: "spontaneous_production",
      });

      expect(relapsedState.relapseState).toBe("relapse");
      expect(relapsedState.currentPriority).toBeGreaterThan(9.0); // High priority remediation!
      expect(relapsedState.srsIntervalDays).toBeLessThan(state.srsIntervalDays); // Shortened interval
    });

    it("should transition from relapse to active_remediation on correct practice", () => {
      const state = masteryEngine.createInitialMastery(VALID_UUID_USER, "tense_simple_past");
      state.relapseState = "relapse";

      const remediationState = masteryEngine.updateMasteryState(state, {
        isCorrect: true,
        evidenceLevel: "controlled_production",
      });

      expect(remediationState.relapseState).toBe("active_remediation");
    });
  });

  describe("4. Personalized Lessons & Contrastive Focus", () => {
    it("should generate a validated lesson with personalized user examples and contrastive focus", async () => {
      const lesson = await service.generateLessonForSkill(VALID_UUID_USER, "tense_simple_past", [
        {
          originalText: "I have seen him yesterday.",
          correctedText: "I saw him yesterday.",
          explanation: "'Yesterday' specifies a completed past time, requiring simple past.",
        },
      ]);

      expect(lesson.lessonId).toBeDefined();
      expect(lesson.skillId).toBe("tense_simple_past");
      expect(lesson.contrastiveFocus).toBeDefined();
      expect(lesson.contrastiveFocus?.conceptA).toContain("Simple Past");
      expect(lesson.contrastiveFocus?.conceptB).toContain("Present Perfect");
      expect(lesson.userPersonalizedExamples.length).toBe(1);
      expect(lesson.userPersonalizedExamples[0]?.originalUtterance).toBe("I have seen him yesterday.");
      expect(lesson.controlledExercises.length).toBeGreaterThan(0);
      expect(lesson.productionExercise).toBeDefined();
    });
  });

  describe("5. Grammar Evaluation & Progress Persistence", () => {
    it("should evaluate attempts, update user mastery, and return structured result", async () => {
      const result = await service.recordAttempt({
        userId: VALID_UUID_USER,
        skillId: "art_definite",
        userAnswer: "The sun is shining today.",
        evidenceLevel: "guided_production",
        isCorrectOverride: true,
      });

      expect(result.attemptId).toBeDefined();
      expect(result.isCorrect).toBe(true);
      expect(result.updatedMastery.evidenceCount).toBe(1);
      expect(result.updatedMastery.masteryScore).toBeGreaterThan(0);

      const profile = service.getUserGrammarProfile(VALID_UUID_USER);
      expect(profile.length).toBeGreaterThan(0);
    });
  });
});
