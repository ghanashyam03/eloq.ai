import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      PRIMARY_LLM_PROVIDER: "huggingface",
      PRIMARY_LLM_MODEL: "meta-llama/Llama-3.2-3B-Instruct",
      FALLBACK_LLM_PROVIDER: "cerebras",
      FALLBACK_LLM_MODEL: "llama3.1-8b",
      GEMINI_API_KEY: "",
      NVIDIA_API_KEY: "",
    },
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", ".next/", "prisma/"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
