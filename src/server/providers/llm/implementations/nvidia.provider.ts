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

export interface NvidiaProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  isFree?: boolean;
}

export class NvidiaLLMProvider implements LLMProvider {
  public readonly providerName: string = "nvidia";
  public readonly isFree: boolean;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(cfg?: NvidiaProviderConfig) {
    this.isFree = cfg?.isFree ?? true;
    this.apiKey =
      cfg?.apiKey ??
      process.env.NVIDIA_NIM_API_KEY ??
      process.env.NVIDIA_API_KEY ??
      config.NVIDIA_NIM_API_KEY ??
      config.NVIDIA_API_KEY;
    this.baseUrl = cfg?.baseUrl ?? "https://integrate.api.nvidia.com/v1";
  }

  async generateCompletion(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw AppError.externalProvider(
        this.providerName,
        "NVIDIA API key is not configured in environment (NVIDIA_API_KEY)"
      );
    }

    const startTime = Date.now();
    const model = options?.model ?? "nvidia/nemotron-3-super-120b-a12b";
    const timeoutMs = options?.timeoutMs ?? config.DEFAULT_LLM_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 2048,
          ...(options?.responseFormat === "json_object"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw AppError.rateLimit(`Rate limit exceeded on provider ${this.providerName}`);
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        throw AppError.externalProvider(
          this.providerName,
          `HTTP ${response.status} from NVIDIA API: ${errText}`
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

      logger.error("NVIDIA LLM call failed", { provider: this.providerName, model }, error);
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
      operationName: options?.taskType ?? "nvidiaStructured",
      schema,
    });
  }
}

export class NvidiaNimLLMProvider extends NvidiaLLMProvider {}
