import { HfInference } from "@huggingface/inference";
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

export class HuggingFaceLLMProvider implements LLMProvider {
  public readonly providerName = "huggingface";
  public readonly isFree = true;
  private client: HfInference | null = null;

  constructor(token?: string) {
    const apiToken = token ?? config.HF_TOKEN;
    if (apiToken) {
      this.client = new HfInference(apiToken);
    } else {
      // Free inference API allows unauthenticated public tier calls with lower rate limits
      this.client = new HfInference();
    }
  }

  async generateCompletion(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options?.model ?? config.PRIMARY_LLM_MODEL;
    const timeoutMs = options?.timeoutMs ?? config.DEFAULT_LLM_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
      if (!this.client) {
        throw AppError.externalProvider(this.providerName, "Hugging Face client is not initialized");
      }

      const hfMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const chatResult = await this.client.chatCompletion(
        {
          model,
          messages: hfMessages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1024,
        },
        {
          fetch: (url, init) =>
            fetch(url, {
              ...init,
              signal: controller.signal,
            }),
        }
      );

      const content = chatResult.choices[0]?.message?.content ?? "";
      const promptTokens = chatResult.usage?.prompt_tokens ?? messages.reduce((a, b) => a + b.content.length, 0);
      const completionTokens = chatResult.usage?.completion_tokens ?? content.length;

      return {
        content,
        rawResponse: chatResult,
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
        throw AppError.timeout(`Hugging Face inference timed out after ${timeoutMs}ms`);
      }

      logger.error("Hugging Face API call failed", { provider: this.providerName, model }, error);

      const errMessage = error instanceof Error ? error.message : String(error);
      if (errMessage.includes("429") || errMessage.toLowerCase().includes("rate limit")) {
        throw AppError.rateLimit("Hugging Face free tier rate limit exceeded");
      }

      throw AppError.externalProvider(this.providerName, `Hugging Face model failure: ${errMessage}`, error);
    } finally {
      clearTimeout(timer);
    }
  }

  async *generateStream(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncIterable<LLMStreamChunk> {
    const model = options?.model ?? config.PRIMARY_LLM_MODEL;
    if (!this.client) {
      throw AppError.externalProvider(this.providerName, "Hugging Face client is not initialized");
    }

    try {
      const stream = this.client.chatCompletionStream({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
      });

      for await (const chunk of stream) {
        if (options?.signal?.aborted) {
          throw AppError.timeout("Stream cancelled by client");
        }
        const delta = chunk.choices[0]?.delta?.content ?? "";
        const isDone = chunk.choices[0]?.finish_reason !== null;
        yield { delta, isDone };
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw AppError.externalProvider(this.providerName, `Hugging Face stream error: ${errMessage}`, error);
    }
  }

  async generateStructured<T>(
    messages: readonly LLMMessage[],
    schema: z.ZodType<T>,
    options?: LLMCompletionOptions
  ): Promise<T> {
    const systemPrompt: LLMMessage = {
      role: "system",
      content: "IMPORTANT: You must respond ONLY with a valid raw JSON object matching the requested schema. Do NOT add markdown codeblocks, prose, or explanations.",
    };

    const response = await this.generateCompletion([systemPrompt, ...messages], {
      ...options,
      responseFormat: "json_object",
    });

    return executeAIPipeline(response.content, {
      providerName: this.providerName,
      operationName: options?.taskType ?? "structuredGeneration",
      schema,
    });
  }
}
