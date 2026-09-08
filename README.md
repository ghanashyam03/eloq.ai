# Eloq AI - Intelligent Real-Time English Fluency & Voice Engine

**Eloq AI** is a state-of-the-art, evidence-backed AI English fluency and voice speaking platform built on **Next.js 16 (App Router & Turbopack)**, **TypeScript**, and **Prisma**. It delivers a real-time, interruptible voice speaking experience, multi-mode scenario simulations, adaptive weakness profiling, active vocabulary spaced repetition (SuperMemo-2), and long-term linguistic analytics.

---

## ✨ Key Subsystems & Architecture

### 1. 🎙️ Real-Time Interruptible Voice Engine
- **Finite State Machine (FSM):** Explicit state management handling human barge-in interruptions across states: `RECORDING` → `TRANSCRIBING` → `THINKING` → `SPEAKING` → `INTERRUPTED`.
- **Keyboard Shortcuts:** Hold or toggle <kbd>Space</kbd> to record, press <kbd>Esc</kbd> to immediately barge-in and interrupt AI playback.
- **Sub-Second Telemetry:** Integrated STT (Whisper/Mock) and TTS (Google/Mock) provider abstractions designed for sub-second turn latency.

### 2. ⚡ Risk-Aware & Free-Only LLM Model Router
- **Multi-Provider Resilience:** Unified router supporting HuggingFace, Cerebras, Groq, Gemini, OpenRouter, and local fallback implementations.
- **Strict Free-Only Safety (`FREE_ONLY_MODE=true`):** Prevents unexpected paid API usage by failing gracefully or falling back to free provider tiers.
- **Risk Taxonomy Gating:** Critical tasks (e.g. grammar analysis) require strict linguistic verifier pass, while low-risk tasks utilize high-throughput free models.

### 3. 🎭 High-Stakes Simulation Scenarios
Supports 6 distinct real-world conversational modes:
- 💬 **Free Conversation:** Open-ended natural dialogue with adaptive real-time feedback.
- 💼 **Job Interview Simulation:** Behavioral and technical interview practice under realistic evaluator pressure.
- ⚖️ **Debate & Persuasion:** AI adopts a strict opposing stance to challenge your argumentation and spontaneous fluency.
- 👔 **Executive Briefing:** Professional workplace scenarios, stakeholder Q&A, and business communication.
- 🎓 **Academic Seminar:** Conceptual discussions requiring precise academic vocabulary and structured logic.
- 🎭 **Immersive Roleplay:** Everyday situational practice across real-world contexts.

### 4. 🧠 Weakness Intelligence & SuperMemo-2 SRS
- **Pattern Normalization:** Categorizes surface speech mistakes into root signature patterns (e.g. preposition misuse, tense shifting, article omission).
- **Active Vocabulary Conversion:** Manages passive-to-active vocabulary conversion with the **SuperMemo-2 (SM-2)** Spaced Repetition algorithm.

### 5. 📊 Long-Term Progress & Skill Transfer Intelligence
- **10 Performance Dimensions:** Tracks metrics including speech rate (WPM), Type-Token Ratio (TTR), filler word frequency, pause frequency, and grammatical accuracy.
- **Skill Transfer Detection:** Monitors whether improvements in controlled practice successfully transfer into spontaneous, unscripted speaking sessions.

### 6. 🔒 Audio Privacy & Cost Safeguards
- **Audio Privacy Cleaner:** In-memory audio buffer sanitization with automatic redaction of raw audio binaries from application logs.
- **Idempotency & Rate Limiter:** Built-in safeguards against duplicate turns and runaway API consumption.
- **Data Deletion Service:** Relational cascading user data deletion (`purgeCompleteUserData`).

---

## 🎨 Minimalist Frontend Philosophy

Eloq AI is designed around **strict minimalism**:
- **Zero Clutter:** Unnecessary developer diagnostic matrices and telemetry panels are removed from the main view to keep user focus on voice practice.
- **Distraction-Free Workspace:** Sleek dark-mode aesthetic with refined glassmorphism, responsive typography, and tactile status indicators.
- **Collapsible Feedback:** Grammar corrections and linguistic insights appear as clean, unobtrusive cards only when suggestions exist.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database (or local instance)

### 2. Environment Setup
Copy `.env.example` to `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eloq_ai_dev"
FREE_ONLY_MODE="true"
PRIMARY_LLM_PROVIDER="gemini"
FALLBACK_LLM_PROVIDER="cerebras"
```

### 3. Installation & Database Migration

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client & Run Migrations
npx prisma generate
npx prisma db push

# 3. Verify TypeScript types
npm run typecheck

# 4. Run Linter
npm run lint

# 5. Run Test Suite (100% passing tests)
npm run test

# 6. Start Development Server
npm run dev
```

The application will be running at [http://localhost:3000](http://localhost:3000).

---

## 🧪 Verification & Testing Commands

- `npm run test`: Runs unit & integration tests (177 tests covering AI router, voice state machine, SRS engine, progress analytics).
- `npm run typecheck`: Validates full strict TypeScript typing.
- `npm run lint`: Verifies ESLint zero-warning policy.
- `npm run build`: Compiles production Next.js build.

---

## 📄 License

MIT License. Designed with excellence for speech mastery and linguistic fluency.
