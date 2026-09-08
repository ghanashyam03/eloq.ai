import { z } from "zod";
import { LLMTaskType } from "./registry/model-task.types";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  timeoutMs?: number;
  signal?: AbortSignal;
  taskType?: LLMTaskType;
}

export interface LLMResponse {
  content: string;
  rawResponse: unknown;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMStreamChunk {
  delta: string;
  isDone: boolean;
}

/**
 * Generic, provider-neutral interface contract for all LLM service implementations.
 */
export interface LLMProvider {
  readonly providerName: string;
  readonly isFree: boolean;

  /**
   * Generates a raw textual completion from the provider model.
   */
  generateCompletion(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMResponse>;

  /**
   * Generates a streaming completion, yielding string deltas.
   */
  generateStream(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncIterable<LLMStreamChunk>;

  /**
   * Generates a completion and enforces Zod schema validation using the AI output pipeline.
   */
  generateStructured<T>(
    messages: readonly LLMMessage[],
    schema: z.ZodType<T>,
    options?: LLMCompletionOptions
  ): Promise<T>;
}
