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
import { config } from "@/lib/config/env";
import { logger } from "@/lib/logger/logger";

export interface GeminiProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  isFree?: boolean;
}

export class GeminiLLMProvider implements LLMProvider {
  public readonly providerName: string = "gemini";
  public readonly isFree: boolean;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(cfg?: GeminiProviderConfig) {
    this.isFree = cfg?.isFree ?? true;
    this.apiKey = cfg?.apiKey ?? config.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
    this.baseUrl = cfg?.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  async generateCompletion(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw AppError.externalProvider(
        this.providerName,
        "Gemini API key is not configured in environment (GEMINI_API_KEY)"
      );
    }

    const startTime = Date.now();
    const model = options?.model ?? "gemini-3.6-flash";
    const timeoutMs = options?.timeoutMs ?? config.DEFAULT_LLM_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      // Map system role to initial user instruction or systemInstruction if present
      const systemMessages = messages.filter((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      const contents = conversationMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // If system instructions exist, prepend as systemInstruction or system content
      const systemInstruction =
        systemMessages.length > 0
          ? { parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }] }
          : undefined;

      const body: Record<string, unknown> = {
        contents,
        ...(systemInstruction ? { systemInstruction } : {}),
        generationConfig: {
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens ?? 2048,
          ...(options?.responseFormat === "json_object"
            ? { responseMimeType: "application/json" }
            : {}),
        },
      };

      const response = await fetch(`${this.baseUrl}/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw AppError.rateLimit(`Rate limit exceeded on provider ${this.providerName}`);
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        throw AppError.externalProvider(
          this.providerName,
          `HTTP ${response.status} from Gemini API: ${errText}`
        );
      }

      const json = await response.json();
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const nonThoughtPart = parts.find(
        (p: { text?: string; thought?: boolean; thoughtSignature?: string }) =>
          typeof p.text === "string" &&
          p.text.trim().length > 0 &&
          !p.thought &&
          !p.thoughtSignature
      );
      const textCandidate = nonThoughtPart?.text ?? parts[parts.length - 1]?.text ?? "";

      const promptTokens =
        json.usageMetadata?.promptTokenCount ??
        messages.reduce((sum, m) => sum + m.content.length, 0);
      const completionTokens =
        json.usageMetadata?.candidatesTokenCount ?? textCandidate.length;

      return {
        content: textCandidate,
        rawResponse: json,
        provider: this.providerName,
        model,
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };
    } catch (error) {
      if (controller.signal.aborted) {
        throw AppError.timeout(`Request timed out after ${timeoutMs}ms on ${this.providerName}`);
      }

      if (error instanceof AppError) throw error;

      logger.error("Gemini LLM call failed", { provider: this.providerName, model }, error);
      throw AppError.externalProvider(
        this.providerName,
        `Communication failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async *generateStream(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    const response = await this.generateCompletion(messages, options);
    yield { delta: response.content, isDone: true };
  }

  async generateStructured<T>(
    messages: readonly LLMMessage[],
    schema: z.ZodType<T>,
    options?: LLMCompletionOptions
  ): Promise<T> {
    const response = await this.generateCompletion(messages, {
      ...options,
      responseFormat: "json_object",
    });

    return executeAIPipeline(response.content, {
      providerName: this.providerName,
      operationName: options?.taskType ?? "geminiStructured",
      schema,
    });
  }
}
