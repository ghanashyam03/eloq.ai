import { z } from "zod";

/**
 * Environment configuration schema enforcing runtime type safety, provider selections,
 * and free-only inference guardrails.
 */
const envSchema = z.object({
  // Required core configuration
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required for database connectivity"),

  // Free-First AI Provider Credentials (Optional)
  HF_TOKEN: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_NIM_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:11434/v1"),

  // Provider Selection Configuration
  PRIMARY_LLM_PROVIDER: z
    .enum(["gemini", "nvidia", "huggingface", "cerebras", "openai-compatible", "local", "mock"])
    .default("gemini"),
  FALLBACK_LLM_PROVIDER: z
    .enum(["gemini", "nvidia", "huggingface", "cerebras", "openai-compatible", "local", "mock"])
    .default("cerebras"),

  // Model Selection Configuration
  PRIMARY_LLM_MODEL: z
    .string()
    .default("gemini-2.0-flash"),
  FALLBACK_LLM_MODEL: z.string().default("llama3.1-8b"),

  // Free-Only Safety Enforcement
  FREE_ONLY_MODE: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .or(z.boolean())
    .default(true),

  // Other AI Provider Capabilities (STT, TTS, Embeddings)
  STT_PROVIDER: z
    .enum(["whisper", "deepgram", "mock"])
    .default("whisper"),
  TTS_PROVIDER: z
    .enum(["elevenlabs", "openai", "mock"])
    .default("openai"),
  EMBEDDING_PROVIDER: z
    .enum(["openai", "mock"])
    .default("openai"),

  // Application Settings
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),
  MAX_AUDIO_DURATION_SECONDS: z.coerce.number().positive().default(300),
  DEFAULT_LLM_TIMEOUT_MS: z.coerce.number().positive().default(30000),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates process.env against the schema at application startup.
 * Provides safe fallback for build-time collection when DATABASE_URL is not set.
 */
function validateEnv(): EnvConfig {
  const fallbackDbUrl =
    process.env["DATABASE_URL"] ||
    "postgresql://postgres:postgres@localhost:5432/eloq_ai_dev";

  const rawEnv = {
    ...process.env,
    DATABASE_URL: fallbackDbUrl,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    const errorMessage = `[Config Error] Invalid environment variables:\n${formattedErrors}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  return Object.freeze(result.data);
}

/**
 * Single source of truth for runtime configuration across the application.
 */
export const config: EnvConfig = validateEnv();
