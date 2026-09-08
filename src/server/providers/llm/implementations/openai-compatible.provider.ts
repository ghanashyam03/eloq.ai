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

export interface OpenAICompatibleConfig {
  baseUrl?: string;
  apiKey?: string;
  providerName?: string;
  isFree?: boolean;
}

export class OpenAICompatibleLLMProvider implements LLMProvider {
  public readonly providerName: string;
  public readonly isFree: boolean;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(cfg?: OpenAICompatibleConfig) {
    this.providerName = cfg?.providerName ?? "openai-compatible";
    this.isFree = cfg?.isFree ?? true;
    this.baseUrl = cfg?.baseUrl ?? config.OPENAI_COMPATIBLE_BASE_URL;
    this.apiKey = cfg?.apiKey ?? config.OPENAI_COMPATIBLE_API_KEY;
  }

  async generateCompletion(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options?.model ?? "llama3:latest";
    const timeoutMs = options?.timeoutMs ?? config.DEFAULT_LLM_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1024,
          response_format: options?.responseFormat === "json_object" ? { type: "json_object" } : undefined,
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw AppError.rateLimit(`Rate limit exceeded on provider ${this.providerName}`);
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => "Unknown error");
        throw AppError.externalProvider(
          this.providerName,
          `HTTP ${response.status} from ${this.baseUrl}: ${errBody}`
        );
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content ?? "";
      const promptTokens = json.usage?.prompt_tokens ?? messages.reduce((a, b) => a + b.content.length, 0);
      const completionTokens = json.usage?.completion_tokens ?? content.length;

      return {
        content,
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

      logger.error("OpenAI-compatible provider call failed", { provider: this.providerName, model }, error);
      throw AppError.externalProvider(
        this.providerName,
        `Communication failed with ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
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
    const model = options?.model ?? "llama3:latest";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
      ...(options?.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok || !response.body) {
      throw AppError.externalProvider(this.providerName, `Stream HTTP ${response.status} from ${this.baseUrl}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") {
          yield { delta: "", isDone: true };
          return;
        }
        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            yield { delta, isDone: false };
          }
        } catch {
          // Ignore partial line JSON errors
        }
      }
    }
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
      operationName: options?.taskType ?? "openaiCompatibleStructured",
      schema,
    });
  }
}
