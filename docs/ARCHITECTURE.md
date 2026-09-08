# System Architecture - AI English Learning System

## Overview

The AI English-Learning Platform is designed to improve a user's real-world English communication ability through a continuous, personalized feedback loop:

`USER SPEAKS -> STT -> Transcript -> Linguistic Analysis -> Error Detection -> Weakness Tracking -> Practice -> Remeasurement -> Personalized Profile`

This document defines the foundational engineering architecture, boundaries, configuration, error handling, logging, validation, and database structure.

---

## 1. Modular Directory Structure

```
src/
  app/                    # Next.js App Router API endpoints & Server Components
  components/             # Presentation UI components (strictly decoupled from DB/AI calls)
  features/               # UI feature containers & workflow state management
  lib/
    config/               # Centralized Zod environment configuration
    errors/               # AppError taxonomy & client error serializer
    logger/               # Contextual structured logging with secret redacting
  server/
    db/                   # Prisma database client singleton & transactional utils
    providers/            # Decoupled AI Provider contracts & validation pipeline
      llm/                # LLMProvider interface & adapters
      stt/                # STTProvider interface & adapters
      tts/                # TTSProvider interface & adapters
      embeddings/         # EmbeddingProvider interface & adapters
      ai-pipeline.ts      # Enforced AI output parsing & Zod validation pipeline
    services/             # Application services (UserService, AnalysisService, etc.)
  domain/                 # Pure domain entities, Zod schemas, and business rules
    users/                # User & UserSettings schemas
    conversation/         # Conversation session schemas
    speech/               # Utterance & audio segment schemas
    analysis/             # Linguistic analysis & error detection schemas
    vocabulary/           # Vocabulary tracking & mastery schemas
    grammar/              # Grammar weakness & pattern schemas
    pronunciation/        # Phoneme evaluation schemas
    learning/             # User learning profile schemas
    progress/             # Historical progress snapshot schemas
    curriculum/           # Dynamic curriculum unit schemas
```

---

## 2. Architectural Boundaries & Decoupling

To ensure long-term extensibility and testability:
1. **UI Layer (`src/components/`, `src/app/`)**:
   - UI components MUST NOT execute database queries or call external AI services directly.
   - All server operations flow through Next.js API routes or Server Actions, delegating logic to Application Services in `src/server/services/`.
2. **Provider Abstractions (`src/server/providers/`)**:
   - LLM, STT, TTS, and Embedding implementations are hidden behind strict TypeScript interfaces.
   - Swapping provider providers (e.g. OpenAI -> Anthropic or Whisper -> Deepgram) requires zero changes to application or domain logic.
3. **AI Output Validation Pipeline (`src/server/providers/ai-pipeline.ts`)**:
   - All raw external model responses follow the mandatory pipeline:
     `Raw Model Response -> JSON Parsing -> Zod Schema Validation -> Domain Entity -> Application Logic`
   - Unvalidated AI model responses are NEVER permitted to mutate database state directly.

---

## 3. Environment & Configuration System

- Managed by `src/lib/config/env.ts`.
- Validates `process.env` at application startup using Zod.
- Random access to `process.env` throughout the application is forbidden.
- Missing required configuration values cause the application to fail fast with a formatted diagnostic message.

---

## 4. Error Handling Taxonomy

Standardized via `AppError` (`src/lib/errors/app-error.ts`):
- `VALIDATION_ERROR` (HTTP 400)
- `AUTHENTICATION_ERROR` (HTTP 401)
- `AUTHORIZATION_ERROR` (HTTP 403)
- `NOT_FOUND_ERROR` (HTTP 404)
- `DATABASE_ERROR` (HTTP 500)
- `EXTERNAL_PROVIDER_ERROR` (HTTP 502)
- `RATE_LIMIT_ERROR` (HTTP 429)
- `TIMEOUT_ERROR` (HTTP 504)
- `INTERNAL_ERROR` (HTTP 500)

Stack traces and sensitive raw details are kept server-side and omitted from public client responses.

---

## 5. Structured Logging & Privacy

- Implemented in `src/lib/logger/logger.ts`.
- Structured JSON output in production, formatted output in development.
- Captures context: `requestId`, `operation`, `provider`, `model`, `latencyMs`, `errorCategory`.
- Automatic redacting mechanism strips API keys, passwords, bearer tokens, and raw audio payloads.

---

## 6. Persistence Foundation

- Managed via Prisma ORM (`prisma/schema.prisma`).
- Database provider: PostgreSQL.
- Initial schema establishes core tables: `users`, `user_settings`, and `app_metadata`.
