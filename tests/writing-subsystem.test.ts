import { describe, it, expect, beforeEach, vi } from "vitest";
import { WritingAnalysisService } from "@/server/services/writing-analysis-service";
import { WritingRewriteService } from "@/server/services/writing-rewrite-service";
import { ModalityMeaningValidator } from "@/server/analysis/modality-meaning-validator";
import { WeaknessProfileService } from "@/server/services/weakness-profile-service";
import { VocabularyService } from "@/server/services/vocabulary-service";

const VALID_UUID_USER = "12345678-1234-4234-8234-123456789abc";

describe("Writing-Analysis & Writing-Practice Subsystem", () => {
  let analysisService: WritingAnalysisService;
  let rewriteService: WritingRewriteService;
  let modalityValidator: ModalityMeaningValidator;
  let mockWeaknessService: WeaknessProfileService;
  let mockVocabService: VocabularyService;

  beforeEach(() => {
    mockWeaknessService = new WeaknessProfileService();
    vi.spyOn(mockWeaknessService, "processLinguisticObservation").mockResolvedValue(undefined);

    mockVocabService = new VocabularyService();
    vi.spyOn(mockVocabService, "extractAndTrackVocabulary").mockResolvedValue([]);

    analysisService = new WritingAnalysisService(mockWeaknessService, mockVocabService);
    modalityValidator = new ModalityMeaningValidator();
    rewriteService = new WritingRewriteService(modalityValidator);
  });

  describe("1. 4 Unmixed Correction Layers", () => {
    it("should separate objective grammar errors into Layer 1 and style/clarity into Layer 3", async () => {
      const input = "He is interested on physics due to the fact that he wants to make a research.";

      const result = await analysisService.analyzeWriting({
        userId: VALID_UUID_USER,
        text: input,
        targetRegister: "professional",
      });

      expect(result.originalText).toBe(input); // Original text preserved intact!
      expect(result.layer1GrammarCorrectness.length).toBeGreaterThan(0);
      expect(result.layer1GrammarCorrectness[0]?.layer).toBe("grammar_correctness");
      expect(result.layer1GrammarCorrectness[0]?.originalText).toBe("interested on");

      expect(result.layer2Naturalness.length).toBeGreaterThan(0);
      expect(result.layer2Naturalness[0]?.layer).toBe("naturalness");
      expect(result.layer2Naturalness[0]?.originalText).toBe("make a research");

      expect(result.layer3StyleClarity.length).toBeGreaterThan(0);
      expect(result.layer3StyleClarity[0]?.layer).toBe("style_clarity");
      expect(result.layer3StyleClarity[0]?.originalText).toBe("due to the fact that");
    });
  });

  describe("2. Register Sensitivity & User Goal Context", () => {
    it("should NOT convert informal casual writing preferences into grammar errors when target register is casual", async () => {
      const casualInput = "Hey, gonna head out now!";

      const result = await analysisService.analyzeWriting({
        userId: VALID_UUID_USER,
        text: casualInput,
        targetRegister: "casual",
      });

      expect(result.layer1GrammarCorrectness.length).toBe(0); // Casual contractions NOT marked as grammar errors!
    });
  });

  describe("3. Modality & Meaning Preservation Audit", () => {
    it("should detect unauthorized modal verb escalation from possibility ('may') to certainty ('will')", () => {
      const orig = "The project may succeed by Q4.";
      const escalatedRewrite = "The project will succeed by Q4.";

      const audit = modalityValidator.auditMeaningPreservation(orig, escalatedRewrite);
      expect(audit.isMeaningPreserved).toBe(false);
      expect(audit.modalityShiftsDetected.length).toBeGreaterThan(0);
      expect(audit.modalityShiftsDetected[0]?.originalModal).toBe("may");
      expect(audit.modalityShiftsDetected[0]?.rewriteModal).toBe("will");
    });

    it("should flag missing numerical facts in rewrites", () => {
      const orig = "We surveyed 500 respondents in 2024.";
      const alteredRewrite = "We surveyed respondents.";

      const audit = modalityValidator.auditMeaningPreservation(orig, alteredRewrite);
      expect(audit.isMeaningPreserved).toBe(false);
      expect(audit.factualDifferenceNote).toBeDefined();
    });
  });

  describe("4. Cross-Subsystem Integration (Weaknesses & Vocabulary)", () => {
    it("should log writing grammar errors to WeaknessProfileService with source = 'writing'", async () => {
      await analysisService.analyzeWriting({
        userId: VALID_UUID_USER,
        text: "I am interested on mathematics.",
      });

      expect(mockWeaknessService.processLinguisticObservation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: VALID_UUID_USER,
          source: "writing", // Verified evidence source!
          subcategory: "preposition",
        })
      );
    });

    it("should track vocabulary encounters in VocabularyService", async () => {
      await analysisService.analyzeWriting({
        userId: VALID_UUID_USER,
        text: "The comprehensive analysis yielded significant observations.",
      });

      expect(mockVocabService.extractAndTrackVocabulary).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: VALID_UUID_USER,
          contextType: "production",
        })
      );
    });
  });

  describe("5. Multi-Style Rewrite Generation", () => {
    it("should generate professional and academic rewrites while preserving original meaning", async () => {
      const orig = "I am interested on physics and want to get better due to the fact that I want to make a research.";

      const rewrite = await rewriteService.generateRewrite({
        originalText: orig,
        rewriteMode: "academic",
      });

      expect(rewrite.originalText).toBe(orig); // Original text preserved intact!
      expect(rewrite.rewrittenText).toContain("interested in");
      expect(rewrite.rewrittenText).toContain("conduct research");
      expect(rewrite.meaningAudit.isMeaningPreserved).toBe(true);
      expect(rewrite.keyChangesSummary.length).toBeGreaterThan(0);
    });
  });
});
