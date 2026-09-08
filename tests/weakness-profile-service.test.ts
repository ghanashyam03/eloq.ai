import { describe, it, expect, beforeEach, vi } from "vitest";
import { WeaknessProfileService } from "@/server/services/weakness-profile-service";
import { userRepository } from "@/server/repositories/user-repository";
import { errorRepository } from "@/server/repositories/error-repository";
import { grammarRepository } from "@/server/repositories/grammar-repository";

const VALID_UUID = "12345678-1234-4234-8234-123456789abc";

describe("Weakness Profile Service", () => {
  let profileService: WeaknessProfileService;

  beforeEach(() => {
    vi.restoreAllMocks();
    profileService = new WeaknessProfileService();

    vi.spyOn(userRepository, "getUserProfile").mockResolvedValue({
      id: VALID_UUID,
      email: "learner@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Learner",
      profile: {
        id: "p-10",
        userId: VALID_UUID,
        targetVariety: "en-US",
        estimatedLevel: "B1",
        correctionIntensity: "medium",
        conversationDifficulty: "intermediate",
        dailyTargetDurationMins: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      settings: null,
      learningGoals: [],
    } as unknown as Awaited<ReturnType<typeof userRepository.getUserProfile>>);

    vi.spyOn(errorRepository, "getUserErrorHistory").mockResolvedValue([
      {
        id: "err-1",
        userId: VALID_UUID,
        errorDefinitionId: "def-1",
        conversationId: "conv-1",
        turnId: "t-1",
        originalText: "I am interested on physics.",
        correctedText: "I am interested in physics.",
        explanation: "Incorrect preposition.",
        category: "grammar",
        severity: "medium",
        confidence: 0.95,
        createdAt: new Date("2026-09-01"),
        turn: null,
        errorDefinition: {
          id: "def-1",
          code: "PREPOSITION_INCORRECT",
          category: "preposition",
          name: "Incorrect Preposition",
          description: "Preposition error",
          difficulty: "intermediate",
          createdAt: new Date(),
        },
      },
      {
        id: "err-2",
        userId: VALID_UUID,
        errorDefinitionId: "def-1",
        conversationId: "conv-2",
        turnId: "t-2",
        originalText: "I am interested on astronomy.",
        correctedText: "I am interested in astronomy.",
        explanation: "Incorrect preposition.",
        category: "grammar",
        severity: "medium",
        confidence: 0.95,
        createdAt: new Date("2026-09-03"),
        turn: null,
        errorDefinition: {
          id: "def-1",
          code: "PREPOSITION_INCORRECT",
          category: "preposition",
          name: "Incorrect Preposition",
          description: "Preposition error",
          difficulty: "intermediate",
          createdAt: new Date(),
        },
      },
    ]);

    vi.spyOn(grammarRepository, "getUserGrammarSkills").mockResolvedValue([]);
  });

  it("should aggregate longitudinal error occurrences into normalized signatures and generate weakness profile", async () => {
    const profile = await profileService.generateWeaknessProfile(VALID_UUID);

    expect(profile.userId).toBe(VALID_UUID);
    expect(profile.topWeaknesses.length).toBeGreaterThan(0);

    const topWeakness = profile.topWeaknesses[0];
    expect(topWeakness?.normalizedKey).toBe("grammar:preposition:preposition_incorrect");
    expect(topWeakness?.occurrenceCount).toBe(2);
    expect(topWeakness?.distinctSessionCount).toBe(2);
    expect(topWeakness?.averageConfidence).toBe(0.95);
  });
});
