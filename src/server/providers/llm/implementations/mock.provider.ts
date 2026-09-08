import { z } from "zod";
import {
  LLMProvider,
  LLMMessage,
  LLMCompletionOptions,
  LLMResponse,
  LLMStreamChunk,
} from "../llm-provider.interface";
import { executeAIPipeline } from "../../ai-pipeline";
import { AppError } from "@/lib/errors/app-error";

export interface MockProviderConfig {
  cannedResponse?: string;
  shouldFail?: boolean;
  failureError?: AppError;
  latencyMs?: number;
}

export class MockLLMProvider implements LLMProvider {
  public readonly providerName = "mock";
  public readonly isFree = true;

  constructor(private config: MockProviderConfig = {}) {}

  public setMockConfig(config: MockProviderConfig): void {
    this.config = { ...this.config, ...config };
  }

  async generateCompletion(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    if (options?.signal?.aborted) {
      throw AppError.timeout("Request aborted before execution");
    }

    if (this.config.latencyMs) {
      await new Promise((res) => setTimeout(res, this.config.latencyMs));
    }

    if (this.config.shouldFail) {
      throw this.config.failureError ?? AppError.externalProvider("mock", "Simulated mock provider failure");
    }

    const lastMessage = messages[messages.length - 1]?.content ?? "";

    let parsedModelFromCanned: string | undefined;
    if (this.config.cannedResponse) {
      try {
        const parsed = JSON.parse(this.config.cannedResponse);
        if (parsed && typeof parsed === "object" && parsed !== null && typeof parsed.model === "string") {
          parsedModelFromCanned = parsed.model;
        }
      } catch {
        // Plain text canned response
      }
    }

    const responseText =
      this.config.cannedResponse ??
      (options?.responseFormat === "json_object"
        ? JSON.stringify({
            overallSummary: `Mock structured summary for: ${lastMessage}`,
            isCompletelyCorrect: false,
            classificationState: "grammatically_incorrect",
            issues: [
              {
                category: "GRAMMAR",
                subcategory: "verb_tense",
                classificationState: "grammatically_incorrect",
                originalText: "don't",
                correctedText: "doesn't",
                explanation: "Subject-verb agreement error.",
                severity: 2,
                confidence: 0.95,
                evidenceSpan: { textSnippet: "don't" },
                uncertaintyState: false,
              },
            ],
            usefulVocabularyEncounters: [],
          })
        : `Hello! I heard you say "${lastMessage.replace(/<\/?UNTRUSTED_USER_INPUT>/gi, "").trim().slice(0, 100)}". That's a great point! What else would you like to share?`);

    const promptTokens = messages.reduce((acc, m) => acc + m.content.length, 0);
    const completionTokens = responseText.length;
    const modelInRaw = parsedModelFromCanned ?? options?.model;

    return {
      content: responseText,
      rawResponse: { mock: true, promptTokens, completionTokens, ...(modelInRaw ? { model: modelInRaw } : {}) },
      provider: this.providerName,
      model: options?.model ?? "mock-llm-v1",
      latencyMs: Date.now() - startTime,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async *generateStream(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    if (this.config.shouldFail) {
      throw this.config.failureError ?? AppError.externalProvider("mock", "Simulated streaming failure");
    }

    const responseText = this.config.cannedResponse ?? "Mock streaming response content";
    const words = responseText.split(" ");

    for (let i = 0; i < words.length; i++) {
      if (options?.signal?.aborted) {
        throw AppError.timeout("Stream aborted by caller");
      }
      const isDone = i === words.length - 1;
      const word = words[i] ?? "";
      yield { delta: i === 0 ? word : ` ${word}`, isDone };
    }
  }

  async generateStructured<T>(
    messages: readonly LLMMessage[],
    schema: z.ZodType<T>,
    options?: LLMCompletionOptions
  ): Promise<T> {
    const rawResponse = await this.generateCompletion(messages, {
      ...options,
      responseFormat: "json_object",
    });

    return executeAIPipeline(rawResponse.content, {
      providerName: this.providerName,
      operationName: options?.taskType ?? "mockStructured",
      schema,
    });
  }
}
