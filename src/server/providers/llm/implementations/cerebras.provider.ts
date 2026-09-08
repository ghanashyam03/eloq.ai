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

export class CerebrasLLMProvider implements LLMProvider {
  public readonly providerName = "cerebras";
  public readonly isFree = true;
  private readonly apiKey: string | undefined;
  private readonly baseUrl = "https://api.cerebras.ai/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? config.CEREBRAS_API_KEY;
  }

  async generateCompletion(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options?.model ?? config.FALLBACK_LLM_MODEL;
    const timeoutMs = options?.timeoutMs ?? config.DEFAULT_LLM_TIMEOUT_MS;

    if (!this.apiKey) {
      throw AppError.externalProvider(
        this.providerName,
        "Cerebras API key is not configured in environment (CEREBRAS_API_KEY)"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
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
        throw AppError.rateLimit("Cerebras inference free tier rate limit or quota exceeded");
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown response error");
        throw AppError.externalProvider(
          this.providerName,
          `Cerebras API HTTP ${response.status}: ${errorText}`
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
        throw AppError.timeout(`Cerebras request timed out after ${timeoutMs}ms`);
      }

      if (error instanceof AppError) throw error;

      logger.error("Cerebras provider request failed", { provider: this.providerName, model }, error);
      throw AppError.externalProvider(
        this.providerName,
        `Cerebras communication failed: ${error instanceof Error ? error.message : String(error)}`,
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
    const model = options?.model ?? config.FALLBACK_LLM_MODEL;

    if (!this.apiKey) {
      throw AppError.externalProvider(this.providerName, "Cerebras API key missing");
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
        stream: true,
      }),
      ...(options?.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok || !response.body) {
      throw AppError.externalProvider(this.providerName, `Cerebras streaming HTTP ${response.status}`);
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
          // Ignore JSON parse errors for incomplete stream lines
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
      operationName: options?.taskType ?? "cerebrasStructured",
      schema,
    });
  }
}
