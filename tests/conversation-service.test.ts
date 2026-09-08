import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConversationService } from "@/server/services/conversation-service";
import { ContextBuilder } from "@/server/services/context-builder";
import { ModelRouter } from "@/server/providers/llm/router/model-router";
import { MockLLMProvider } from "@/server/providers/llm/implementations/mock.provider";
import { userRepository } from "@/server/repositories/user-repository";
import { conversationRepository } from "@/server/repositories/conversation-repository";
import { errorRepository } from "@/server/repositories/error-repository";
import { vocabularyRepository } from "@/server/repositories/vocabulary-repository";
import { learningEventRepository } from "@/server/repositories/learning-event-repository";
import { AppError } from "@/lib/errors/app-error";
import {
  shortAnswerFixture,
  longAnswerFixture,
  topicChangeFixture,
  incorrectEnglishFixture,
  advancedEnglishFixture,
  promptInjectionAttemptFixture,
} from "./fixtures/conversation-fixtures";

describe("Conversation Intelligence Engine", () => {
  let conversationService: ConversationService;
  let mockRouter: ModelRouter;
  let mockContextBuilder: ContextBuilder;
  let primaryMock: MockLLMProvider;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockRouter = new ModelRouter();
    primaryMock = new MockLLMProvider({ cannedResponse: "That is interesting. Tell me more about your experience." });
    mockRouter.registerProvider("gemini", primaryMock);
    mockRouter.registerProvider("huggingface", primaryMock);
    mockRouter.registerProvider("nvidia", primaryMock);
    mockRouter.registerProvider("openrouter", primaryMock);
    mockRouter.registerProvider("cerebras", primaryMock);
    mockRouter.registerProvider("local", primaryMock);
    mockRouter.registerProvider("mock", primaryMock);

    mockContextBuilder = new ContextBuilder();
    conversationService = new ConversationService(mockRouter, mockContextBuilder);

    // Mock DB calls
    vi.spyOn(userRepository, "getUserProfile").mockResolvedValue({
      id: "u-1",
      email: "test@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test User",
      profile: {
        id: "p-1",
        userId: "u-1",
        targetVariety: "en-US",
        estimatedLevel: "B2",
        correctionIntensity: "medium",
        conversationDifficulty: "intermediate",
        dailyTargetDurationMins: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      settings: null,
      learningGoals: [
        { id: "g-1", userId: "u-1", category: "conversational", description: "Improve fluency", priority: 1, isCompleted: false, createdAt: new Date(), updatedAt: new Date() },
      ],
    } as unknown as Awaited<ReturnType<typeof userRepository.getUserProfile>>);

    vi.spyOn(conversationRepository, "createConversation").mockResolvedValue({
      id: "conv-100",
      userId: "u-1",
      mode: "free_conversation",
      difficulty: "intermediate",
      goalContext: null,
      status: "active",
      startedAt: new Date(),
      endedAt: null,
      durationSeconds: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(conversationRepository, "getConversationHistory").mockResolvedValue({
      id: "conv-100",
      userId: "u-1",
      mode: "free_conversation",
      difficulty: "intermediate",
      goalContext: null,
      status: "active",
      startedAt: new Date(),
      endedAt: null,
      durationSeconds: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      turns: [
        {
          id: "t-1",
          conversationId: "conv-100",
          speaker: "user",
          turnOrder: 1,
          text: "Hello!",
          audioUrl: null,
          durationSeconds: null,
          providerMetadata: null,
          createdAt: new Date(),
          speechSegments: [],
          errorOccurrences: [],
        },
      ],
    });

    vi.spyOn(conversationRepository, "addTurn").mockImplementation(async (dto) => ({
      turn: {
        id: "t-2",
        conversationId: dto.conversationId,
        speaker: dto.speaker,
        turnOrder: 2,
        text: dto.text,
        audioUrl: dto.audioUrl ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        providerMetadata: null,
        createdAt: new Date(),
      },
      segment: null,
    }));

    vi.spyOn(errorRepository, "getUserErrorHistory").mockResolvedValue([]);
    vi.spyOn(vocabularyRepository, "getUserVocabulary").mockResolvedValue([]);
    vi.spyOn(learningEventRepository, "logEvent").mockResolvedValue({
      id: "evt-1",
      userId: "u-1",
      eventType: "test",
      entityType: "test",
      entityId: "1",
      payload: {},
      createdAt: new Date(),
    });
  });

  it("should initialize a conversation session correctly", async () => {
    const conv = await conversationService.startConversation("u-1", { mode: "casual" });
    expect(conv.id).toBe("conv-100");
    expect(conversationRepository.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-1", mode: "casual" })
    );
  });

  it("should process user turns with short, long, topic change, and advanced English quality fixtures", async () => {
    const fixtures = [
      shortAnswerFixture,
      longAnswerFixture,
      topicChangeFixture,
      incorrectEnglishFixture,
      advancedEnglishFixture,
    ];

    for (const text of fixtures) {
      const result = await conversationService.processUserTurn("conv-100", text);
      expect(result.text).toBe(text);
      expect(result.speaker).toBe("user");
    }
  });

  it("should generate assistant turns using model router and persist assistant responses", async () => {
    const assistantResult = await conversationService.generateAssistantTurn("conv-100", {
      mode: "free_conversation",
      correctionMode: "balanced",
    });

    expect(assistantResult.speaker).toBe("assistant");
    expect(assistantResult.text).toBe("That is interesting. Tell me more about your experience.");
  });

  it("should defend against prompt injection attempts without crashing or compromising system rules", async () => {
    const userTurnResult = await conversationService.processUserTurn("conv-100", promptInjectionAttemptFixture);
    expect(userTurnResult.text).toBe(promptInjectionAttemptFixture);

    const assistantResult = await conversationService.generateAssistantTurn("conv-100", {
      mode: "free_conversation",
    });

    expect(assistantResult.speaker).toBe("assistant");
    expect(assistantResult.text).not.toContain("<UNTRUSTED_USER_INPUT>");
  });

  it("should NOT persist assistant turn state if model router provider fails", async () => {
    primaryMock.setMockConfig({
      shouldFail: true,
      failureError: AppError.externalProvider("mock", "AI provider timeout"),
    });

    await expect(
      conversationService.generateAssistantTurn("conv-100")
    ).rejects.toThrow();

    // Verify addTurn was only called for successful operations
    expect(conversationRepository.addTurn).not.toHaveBeenCalledWith(
      expect.objectContaining({ speaker: "assistant" })
    );
  });
});
