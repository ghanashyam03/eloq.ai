# Architecture Decision Records (ADRs)

## ADR 001: Unified Next.js Application Architecture

**Status**: Accepted

**Context**:
The system requires a scalable web application that acts as a secure server-side proxy for AI provider secrets while serving a responsive frontend.

**Decision**:
Use a single Next.js application with App Router rather than splitting into separate frontend and backend repositories.

**Consequences**:
- Simplifies local development, deployment, and type sharing between server and domain layers.
- Keeps provider credentials strictly on the server side using Server Components, API Routes, and Server Actions.

---

## ADR 002: Strict Provider Decoupling & Interface Contracts

**Status**: Accepted

**Context**:
AI model capabilities (LLM, STT, TTS, Embeddings) evolve rapidly. The system must allow switching providers without rewriting application logic.

**Decision**:
Define strict TypeScript interfaces (`LLMProvider`, `STTProvider`, `TTSProvider`, `EmbeddingProvider`) in `src/server/providers/`. Application services depend exclusively on these interfaces.

**Consequences**:
- Provider implementations can be swapped cleanly via environment configuration.
- Simplifies unit testing via provider mocks and test stubs.

---

## ADR 003: Mandatory AI Output Validation Pipeline

**Status**: Accepted

**Context**:
External AI model outputs are nondeterministic and can contain structural anomalies. Allowing unvalidated model output to write directly to database state creates data corruption risks.

**Decision**:
Enforce the validation pipeline pattern for all model outputs:
`External Model -> Raw Output -> JSON Parsing -> Zod Schema Validation -> Domain Object`.

**Consequences**:
- Any unexpected output format throws a typed `AppError.validation` or `AppError.externalProvider` before reaching application logic or database persistence.
- Guarantees runtime type safety for all domain state.

---

## ADR 004: Centralized Configuration System

**Status**: Accepted

**Context**:
Direct access to `process.env` scattered across components leads to runtime crashes when environment variables are missing or misconfigured.

**Decision**:
Create `src/lib/config/env.ts` which parses and validates environment variables at startup via Zod and exports a frozen, typed configuration object.

**Consequences**:
- Application fails fast at startup if required variables are missing.
- Prevents invalid environment states from causing subtle downstream errors.
