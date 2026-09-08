import { describe, it, expect, beforeEach, vi } from "vitest";
import { scenarioRegistry } from "@/server/speech/scenario-registry";
import { simulationEvaluator } from "@/server/speech/simulation-evaluator";
import { buildConversationPromptV1 } from "@/server/prompts/conversation.v1";
import { conversationRepository } from "@/server/repositories/conversation-repository";
import { PromptContextPayload } from "@/domain/conversation/conversation-mode.types";
import { SimulationSessionReportSchema } from "@/domain/speech/speaking-simulation.schema";

describe("Advanced Speaking Simulation Subsystem", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Scenario Registry & Definitions", () => {
    it("should register all 6 required speaking simulation modes with full configurations", () => {
      const scenarios = scenarioRegistry.getAllScenarios();
      expect(scenarios.length).toBeGreaterThanOrEqual(6);

      const simulationTypes = scenarios.map((s) => s.type);
      expect(simulationTypes).toContain("interview");
      expect(simulationTypes).toContain("debate");
      expect(simulationTypes).toContain("presentation");
      expect(simulationTypes).toContain("roleplay");
      expect(simulationTypes).toContain("academic_discussion");
      expect(simulationTypes).toContain("professional_scenario");
    });

    it("should retrieve specific scenario definitions by ID or type", () => {
      const interviewScen = scenarioRegistry.getScenario("sim_interview_tech");
      expect(interviewScen.type).toBe("interview");
      expect(interviewScen.roleConfiguration.aiRole).toBe("interviewer");
      expect(interviewScen.evaluationDimensions).toContain("relevance");

      const debateScen = scenarioRegistry.findScenarioByType("debate");
      expect(debateScen).toBeDefined();
      expect(debateScen?.roleConfiguration.opposingStance).toBeDefined();
    });

    it("should throw a AppError.notFound for invalid scenario IDs", () => {
      expect(() => scenarioRegistry.getScenario("non_existent_id")).toThrow("Scenario definition 'non_existent_id' not found");
    });
  });

  describe("2. Conversation Engine Prompt & Scenario Context Integration", () => {
    it("should inject scenario objectives, roles, and debate opposing stances into system prompts", () => {
      const debateScenario = scenarioRegistry.getScenario("sim_debate_ai_ethics");

      const contextPayload: PromptContextPayload = {
        mode: "debate",
        scenarioId: "sim_debate_ai_ethics",
        difficulty: "C1",
        correctionMode: "balanced",
        userProfile: {
          targetVariety: "en-US",
          estimatedLevel: "B2",
        },
        recentTurns: [
          { speaker: "user", text: "AI regulation will stifle innovation." },
        ],
        learningGoals: [],
        recurringWeaknesses: [],
        targetVocabulary: debateScenario.targetSkills,
      };

      const messages = buildConversationPromptV1(contextPayload);
      const systemMessage = messages.find((m) => m.role === "system");

      expect(systemMessage).toBeDefined();
      expect(systemMessage?.content).toContain("SCENARIO SIMULATION");
      expect(systemMessage?.content).toContain("DEBATE OPPOSING STANCE");
      expect(systemMessage?.content).toContain(debateScenario.roleConfiguration.opposingStance!);
    });

    it("should inject follow-up intelligence directives into interviewer simulation prompts", () => {
      const interviewScenario = scenarioRegistry.getScenario("sim_interview_tech");

      const contextPayload: PromptContextPayload = {
        mode: "interview",
        scenarioId: "sim_interview_tech",
        difficulty: "B2",
        correctionMode: "balanced",
        userProfile: {
          targetVariety: "en-US",
          estimatedLevel: "B2",
        },
        recentTurns: [
          { speaker: "user", text: "I led the migration of our monolith to microservices using Node.js." },
        ],
        learningGoals: [],
        recurringWeaknesses: [],
        targetVocabulary: interviewScenario.targetSkills,
      };

      const messages = buildConversationPromptV1(contextPayload);
      const systemMessage = messages.find((m) => m.role === "system");

      expect(systemMessage?.content).toContain("SCENARIO SIMULATION");
      expect(systemMessage?.content).toContain("Behavioral Directives");
      expect(systemMessage?.content).toContain("ask direct follow-ups referencing their exact claims");
      expect(systemMessage?.content).toContain("Challenge vague, generic, or incomplete answers");
    });
  });

  describe("3. Simulation Evaluator & Report Generation across Mock Scenarios", () => {
    const mockUserId = "123e4567-e89b-12d3-a456-426614174000";
    const mockConvId = "conv-eval-100";

    it("should evaluate a Strong Answer session with detailed structure, good vocabulary, and signposts", async () => {
      vi.spyOn(conversationRepository, "getConversationHistory").mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        mode: "interview",
        difficulty: "B2",
        goalContext: null,
        status: "completed",
        startedAt: new Date(Date.now() - 300000),
        endedAt: new Date(),
        durationSeconds: 300,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [
          {
            id: "t1",
            conversationId: mockConvId,
            speaker: "user",
            turnOrder: 1,
            text: "First, I evaluated our system bottlenecks. Second, I refactored the database queries. Therefore, latency decreased by forty percent.",
            audioUrl: null,
            durationSeconds: 30,
            providerMetadata: null,
            createdAt: new Date(),
            speechSegments: [],
            errorOccurrences: [],
          },
        ],
      });

      const report = await simulationEvaluator.evaluateSession({
        conversationId: mockConvId,
        scenarioId: "sim_interview_tech",
        speechMetrics: { hesitationFillerCount: 0, totalPauses: 1, averageWpm: 130, repetitionCount: 0 },
      });

      expect(SimulationSessionReportSchema.safeParse(report).success).toBe(true);
      expect(report.strengths.length).toBeGreaterThan(0);
      expect(report.strengths).toContain("Clean delivery with minimal hesitation fillers (um/uh)");
      expect(report.dimensionScores["structure"]).toBeGreaterThanOrEqual(70);
    });

    it("should evaluate a Weak/Short Answer session and identify hesitation fillers and brevity weaknesses", async () => {
      vi.spyOn(conversationRepository, "getConversationHistory").mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        mode: "interview",
        difficulty: "B2",
        goalContext: null,
        status: "completed",
        startedAt: new Date(Date.now() - 120000),
        endedAt: new Date(),
        durationSeconds: 120,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [
          {
            id: "t1",
            conversationId: mockConvId,
            speaker: "user",
            turnOrder: 1,
            text: "Um, yeah, I guess so. Um, we just did it. Um.",
            audioUrl: null,
            durationSeconds: 15,
            providerMetadata: null,
            createdAt: new Date(),
            speechSegments: [],
            errorOccurrences: [],
          },
        ],
      });

      const report = await simulationEvaluator.evaluateSession({
        conversationId: mockConvId,
        scenarioId: "sim_interview_tech",
        speechMetrics: { hesitationFillerCount: 3, totalPauses: 4, averageWpm: 70, repetitionCount: 1 },
      });

      expect(report.weaknesses.some((w) => w.includes("hesitation fillers"))).toBe(true);
      expect(report.weaknesses.some((w) => w.includes("brief or evasive"))).toBe(true);
      expect(report.recommendations.some((r) => r.includes("verbal fillers"))).toBe(true);
    });

    it("should evaluate a Debate Mode session with contradictory/unsupported claims", async () => {
      vi.spyOn(conversationRepository, "getConversationHistory").mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        mode: "debate",
        difficulty: "C1",
        goalContext: null,
        status: "completed",
        startedAt: new Date(Date.now() - 200000),
        endedAt: new Date(),
        durationSeconds: 200,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [
          {
            id: "t1",
            conversationId: mockConvId,
            speaker: "user",
            turnOrder: 1,
            text: "AI is completely safe because I think it is fine. There is no proof it causes any harm.",
            audioUrl: null,
            durationSeconds: 20,
            providerMetadata: null,
            createdAt: new Date(),
            speechSegments: [],
            errorOccurrences: [],
          },
        ],
      });

      const report = await simulationEvaluator.evaluateSession({
        conversationId: mockConvId,
        scenarioId: "sim_debate_ai_ethics",
      });

      expect(report.simulationType).toBe("debate");
      expect(report.recommendations.some((r) => r.includes("empirical evidence"))).toBe(true);
    });

    it("should evaluate a Presentation Mode session and track opening, structure, and recommendations", async () => {
      vi.spyOn(conversationRepository, "getConversationHistory").mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        mode: "presentation",
        difficulty: "B2",
        goalContext: null,
        status: "completed",
        startedAt: new Date(Date.now() - 300000),
        endedAt: new Date(),
        durationSeconds: 300,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [
          {
            id: "t1",
            conversationId: mockConvId,
            speaker: "user",
            turnOrder: 1,
            text: "Good morning everyone. Today I will present our quarterly strategic plan for market growth.",
            audioUrl: null,
            durationSeconds: 30,
            providerMetadata: null,
            createdAt: new Date(),
            speechSegments: [],
            errorOccurrences: [],
          },
        ],
      });

      const report = await simulationEvaluator.evaluateSession({
        conversationId: mockConvId,
        scenarioId: "sim_presentation_keynote",
      });

      expect(report.simulationType).toBe("presentation");
      expect(report.recommendations.some((r) => r.includes("signpost transitions"))).toBe(true);
    });

    it("should detect recurring preposition and article grammatical errors from stored evidence", async () => {
      vi.spyOn(conversationRepository, "getConversationHistory").mockResolvedValue({
        id: mockConvId,
        userId: mockUserId,
        mode: "roleplay",
        difficulty: "B2",
        goalContext: null,
        status: "completed",
        startedAt: new Date(Date.now() - 150000),
        endedAt: new Date(),
        durationSeconds: 150,
        createdAt: new Date(),
        updatedAt: new Date(),
        turns: [
          {
            id: "t1",
            conversationId: mockConvId,
            speaker: "user",
            turnOrder: 1,
            text: "I am very interested on this project, but we need to discuss about the budget for a apple project.",
            audioUrl: null,
            durationSeconds: 20,
            providerMetadata: null,
            createdAt: new Date(),
            speechSegments: [],
            errorOccurrences: [],
          },
        ],
      });

      const report = await simulationEvaluator.evaluateSession({
        conversationId: mockConvId,
        scenarioId: "sim_roleplay_client",
      });

      expect(report.recurringErrors.length).toBeGreaterThan(0);
      expect(report.recurringErrors.some((e) => e.includes("Preposition misuse"))).toBe(true);
      expect(report.recurringErrors.some((e) => e.includes("Indefinite article error"))).toBe(true);
    });
  });
});
