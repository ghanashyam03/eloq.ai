# AI Provider Abstraction & Model Routing Architecture

## Overview

The AI English-Learning platform uses a **free-first, provider-neutral model routing architecture**. The core domain logic never depends on any single external LLM vendor or paid API key.

```
Task Request (e.g. grammar_analysis)
  ↓
Model Router (src/server/providers/llm/router/model-router.ts)
  ↓ Checks capabilities & free-only safety
Model Registry (src/server/providers/llm/registry/model-registry.ts)
  ↓ Selects Primary vs Fallback
Provider Implementation (Hugging Face / Cerebras / Local / OpenAI-Compatible)
  ↓ Retries with Exponential Backoff on transient failures
Raw Completion -> JSON Parse -> Zod Pipeline -> Domain Object
```

---

## 1. Provider Abstraction Contract

All provider implementations implement the `LLMProvider` contract (`src/server/providers/llm/llm-provider.interface.ts`):

- `generateCompletion`: Text completions with token usage and latency.
- `generateStream`: Yields string chunk deltas.
- `generateStructured`: Safe JSON output validation via `executeAIPipeline`.
- Support for `model`, `temperature`, `maxTokens`, `timeoutMs`, and `signal` (`AbortSignal`).

Supported Providers:
1. **Hugging Face (`huggingface`)**: Uses official `@huggingface/inference` SDK.
2. **Cerebras (`cerebras`)**: Ultra-fast inference API with rate-limit & quota handling.
3. **OpenAI-Compatible (`openai-compatible`)**: Generic endpoint compatible with Ollama, Groq, OpenRouter free tier, and LocalAI.
4. **Local Provider (`local`)**: Pre-configured local Ollama instance (`http://localhost:11434/v1`).
5. **Mock Provider (`mock`)**: Network-free deterministic provider for unit and integration tests.

---

## 2. Environment Configuration

Environment configuration is managed via `src/lib/config/env.ts`:

```env
# Free-First AI Credentials (Optional)
HF_TOKEN=hf_...
CEREBRAS_API_KEY=csk-...
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_BASE_URL=http://localhost:11434/v1

# Provider & Model Defaults
PRIMARY_LLM_PROVIDER=huggingface
FALLBACK_LLM_PROVIDER=cerebras
PRIMARY_LLM_MODEL=meta-llama/Llama-3.2-3B-Instruct
FALLBACK_LLM_MODEL=llama3.1-8b

# Free-Only Safety Enforcement
FREE_ONLY_MODE=true
```

---

## 3. Free-Only Safety Enforcement

When `FREE_ONLY_MODE=true` (default):
- The model router **only** selects models marked with `isFree: true` in the `ModelRegistry`.
- If all configured free providers are offline or rate-limited, the system throws a typed provider error:
  `"No configured free AI provider is currently available."`
- The system will **never** automatically fall back to paid providers or incur unexpected charges.

---

## 4. Model Registry

Model metadata is centrally maintained in `src/server/providers/llm/registry/model-registry.ts`:

```typescript
{
  provider: "huggingface",
  modelId: "meta-llama/Llama-3.2-3B-Instruct",
  displayName: "Llama 3.2 3B Instruct (HF)",
  isFree: true,
  contextLength: 131072,
  capabilities: {
    streaming: "supported",
    structuredOutput: "unknown",
    reasoning: "supported",
    vision: "unsupported",
  },
  status: "active",
  intendedTasks: ["conversation", "grammar_analysis", "vocabulary_analysis", "error_classification"],
}
```

Capabilities that have not been empirically verified are explicitly marked as `"unknown"`.

---

## 5. Resilient Retries & Fallback Engine

1. **Error Classification**:
   - **Retryable Errors**: Network failures (`ECONNRESET`, `ETIMEDOUT`), HTTP 429 rate limits, HTTP 503/502 server errors, timeouts.
   - **Non-Retryable Errors**: HTTP 400 Bad Request, Zod schema validation errors, authentication failures, invalid prompts.
2. **Exponential Backoff**: Transient errors are retried up to `maxAttempts` (default: 2) with backoff before triggering provider failover.
3. **Primary-to-Fallback Failover**: If the primary provider fails due to a retryable error, the router transparently switches to the fallback provider/model.

---

## 6. How to Add a New Provider

1. Create a class implementing `LLMProvider` in `src/server/providers/llm/implementations/`.
2. Implement `generateCompletion`, `generateStream`, and `generateStructured`.
3. Add the provider type to `ProviderType` in `src/server/providers/llm/registry/model-task.types.ts`.
4. Register provider instantiation in `ModelRouter.getProvider()`.

---

## 7. How to Add a New Model

1. Open `src/server/providers/llm/registry/model-registry.ts`.
2. Add a new `ModelMetadata` entry specifying `provider`, `modelId`, `isFree`, `capabilities`, `status`, and `intendedTasks`.

---

## 8. Quota & Usage Monitoring

- Metrics are automatically captured by `UsageTracker` (`src/server/providers/llm/metrics/usage-tracker.ts`).
- Records: `taskType`, `provider`, `model`, `promptTokens`, `completionTokens`, `totalTokens`, `latencyMs`, `success`, `timestamp`.
- **Privacy Assurance**: API keys, auth headers, and user PII are never logged or stored.
