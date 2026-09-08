import { describe, it, expect } from "vitest";
import { userRepository } from "@/server/repositories/user-repository";
import { conversationRepository } from "@/server/repositories/conversation-repository";
import { vocabularyRepository } from "@/server/repositories/vocabulary-repository";
import { grammarRepository } from "@/server/repositories/grammar-repository";
import { learningEventRepository } from "@/server/repositories/learning-event-repository";

describe("Database Repositories & Raw Evidence Logic", () => {
  it("should define user repository methods for cascade profiles and goals", () => {
    expect(userRepository.createUserProfile).toBeDefined();
    expect(userRepository.getUserProfile).toBeDefined();
    expect(userRepository.deleteUser).toBeDefined();
  });

  it("should define conversation repository methods for turn ordering and speech timing", () => {
    expect(conversationRepository.createConversation).toBeDefined();
    expect(conversationRepository.addTurn).toBeDefined();
    expect(conversationRepository.getConversationHistory).toBeDefined();
  });

  it("should define active vs passive vocabulary tracking methods", () => {
    expect(vocabularyRepository.trackEncounter).toBeDefined();
    expect(vocabularyRepository.getUserVocabulary).toBeDefined();
  });

  it("should define grammar skill mastery calculation methods", () => {
    expect(grammarRepository.recordAttempt).toBeDefined();
    expect(grammarRepository.getUserGrammarSkills).toBeDefined();
  });

  it("should define learning event audit logging methods", () => {
    expect(learningEventRepository.logEvent).toBeDefined();
    expect(learningEventRepository.getEventsForUser).toBeDefined();
  });
});
