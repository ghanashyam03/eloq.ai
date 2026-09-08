import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockSTTProvider } from "@/server/providers/stt/mock-stt.provider";
import { ConversationService } from "@/server/services/conversation-service";
import { ModelRouter } from "@/server/providers/llm/router/model-router";
import { MockLLMProvider } from "@/server/providers/llm/implementations/mock.provider";
import { conversationRepository } from "@/server/repositories/conversation-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { errorRepository } from "@/server/repositories/error-repository";
import { vocabularyRepository } from "@/server/repositories/vocabulary-repository";
import { learningEventRepository } from "@/server/repositories/learning-event-repository";

describe("Speech to Conversation Engine Pipeline Integration", () => {
  let sttProvider: MockSTTProvider;
  let conversationService: ConversationService;
  let mockRouter: ModelRouter;

  beforeEach(() => {
    vi.restoreAllMocks();

    sttProvider = new MockSTTProvider({
      cannedTranscript: "I went to the university yesterday to meet my professor.",
    });

    mockRouter = new ModelRouter();
    const primaryMock = new MockLLMProvider({
      cannedResponse: "That sounds like a productive day! What did you and your professor discuss?",
    });
    mockRouter.registerProvider("gemini", primaryMock);
    mockRouter.registerProvider("huggingface", primaryMock);
    mockRouter.registerProvider("nvidia", primaryMock);
    mockRouter.registerProvider("openrouter", primaryMock);
    mockRouter.registerProvider("cerebras", primaryMock);
    mockRouter.registerProvider("local", primaryMock);
    mockRouter.registerProvider("mock", primaryMock);

    conversationService = new ConversationService(mockRouter);

    // Mock DB calls
    vi.spyOn(userRepository, "getUserProfile").mockResolvedValue(null);
    vi.spyOn(conversationRepository, "getConversationHistory").mockResolvedValue({
      id: "conv-200",
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
      turns: [],
    });

    vi.spyOn(conversationRepository, "addTurn").mockImplementation(async (dto) => ({
      turn: {
        id: `t-${dto.speaker}-1`,
        conversationId: dto.conversationId,
        speaker: dto.speaker,
        turnOrder: 1,
        text: dto.text,
        audioUrl: null,
        durationSeconds: dto.durationSeconds ?? null,
        providerMetadata: null,
        createdAt: new Date(),
      },
      segment: null,
    }));

    vi.spyOn(errorRepository, "getUserErrorHistory").mockResolvedValue([]);
    vi.spyOn(vocabularyRepository, "getUserVocabulary").mockResolvedValue([]);
    vi.spyOn(learningEventRepository, "logEvent").mockResolvedValue({
      id: "e-1",
      userId: "u-1",
      eventType: "test",
      entityType: "test",
      entityId: "1",
      payload: {},
      createdAt: new Date(),
    });
  });

  it("should process raw audio, transcribe to text, pass to conversation service, and generate assistant response", async () => {
    const rawAudioBuffer = Buffer.from("SYNTHETIC_USER_SPEECH_AUDIO");

    // 1. Transcribe audio using STT provider
    const sttResult = await sttProvider.transcribeBuffer(rawAudioBuffer, "audio/webm");
    expect(sttResult.fullText).toBe("I went to the university yesterday to meet my professor.");

    // 2. Process user turn in conversation engine
    const userTurn = await conversationService.processUserTurn(
      "conv-200",
      sttResult.fullText,
      sttResult.durationSeconds
    );
    expect(userTurn.speaker).toBe("user");
    expect(userTurn.text).toBe("I went to the university yesterday to meet my professor.");

    // 3. Generate assistant response turn
    const assistantTurn = await conversationService.generateAssistantTurn("conv-200");
    expect(assistantTurn.speaker).toBe("assistant");
    expect(assistantTurn.text).toBe("That sounds like a productive day! What did you and your professor discuss?");
  });
});
