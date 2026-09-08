# Eloq AI — Real-Time English Fluency & Spoken Mastery Engine

Eloq AI is an advanced, evidence-backed AI platform designed to transform passive English knowledge into spontaneous, high-stakes spoken fluency.

Unlike conventional language-learning applications that rely on static flashcards or basic chatbot prompts, Eloq AI operates as an intelligent voice coach. It integrates a real-time interruptible speaking engine, multi-mode simulation scenarios, deterministic error profiling, spaced repetition active vocabulary scheduling, and long-term skill transfer analytics.

---

## 🏛️ System Architecture & Subsystems

### 🎙️ 1. Real-Time Speech Pipeline & Interruption State Machine
The core speaking experience is driven by an explicit **Finite State Machine (FSM)** that models natural human conversation dynamics:
* **Barge-In Interruptibility:** The FSM safely manages transitions across `RECORDING` → `TRANSCRIBING` → `THINKING` → `SPEAKING` → `INTERRUPTED`. If the user interrupts mid-sentence, the AI immediately halts speech output, truncates the audio stream, and begins processing the user's new turn.
* **Low-Latency Telemetry:** Speech-to-Text (STT) and Text-to-Speech (TTS) abstractions deliver sub-second latency tracking, capturing precise pause counts, filler words, speech rate (WPM), and articulation metrics without blocking the conversational flow.

---

### 🧠 2. Weakness Intelligence & Root Error Normalization
Rather than storing isolated surface mistakes (e.g., *"I goes to market"*), Eloq AI normalizes error evidence into persistent **Root Weakness Signatures**:
* **Linguistic Taxonomy:** Categorizes errors into root structural categories (e.g., Subject-Verb Agreement, Preposition Selection, Article Omission, Tense Consistency, Register Inappropriateness).
* **Confidence Calibration:** Computes a statistical confidence score for each identified weakness based on occurrence frequency, context variety, and time elapsed.
* **Deterministic-First Analysis:** Evaluates non-structural parameters (speech pace, filler density, hesitation pauses) deterministically without relying on LLM outputs, guaranteeing zero-hallucination metrics.

---

### 🗂️ 3. Spaced Repetition (SuperMemo-2) Active Vocabulary Engine
Eloq AI explicitly distinguishes between **passive vocabulary** (words a user recognizes when reading/listening) and **active vocabulary** (words a user spontaneously uses when speaking):
* **SuperMemo-2 (SM-2) Scheduling:** Automatically tracks newly encountered vocabulary items and schedules active production exercises based on calculated review intervals ($I$), repetition counts ($n$), and ease factors ($EF$).
* **Passive-to-Active Conversion:** Formulates real-time prompts that require the user to produce target vocabulary items in context during speaking sessions.

---

### 🎭 4. Adaptive Scenario & Simulation Engine
The platform simulates real-world, high-stakes communication environments through 6 distinct operational modes:
* **💬 Free Conversation:** Open dialogue with continuous, real-time linguistic feedback.
* **💼 Job Interview Simulation:** Behavioral and technical interview scenarios with interviewer follow-ups, challenge questions, and structured response evaluations.
* **⚖️ Debate & Persuasion:** The AI assumes a strict opposing stance, forcing the user to construct logical counterarguments, defend positions, and maintain fluency under pressure.
* **👔 Executive Briefing:** Workplace scenarios requiring concise, high-level stakeholder communication, executive phrasing, and professional register.
* **🎓 Academic Seminar:** Analytical discussions requiring precise conceptual vocabulary and formal discourse markers.
* **🎭 Immersive Roleplay:** Real-world situational practice tailored to everyday environments.

---

### 📊 5. Long-Term Analytics & Skill Transfer Intelligence
Eloq AI monitors long-term progress across **10 performance dimensions** to measure true fluency growth:
* **Performance Metric Suite:** Tracks speech rate (Words Per Minute), Type-Token Ratio (Vocabulary Diversity), Pause Frequency, Filler Word Rate, and Grammatical Accuracy.
* **Skill Transfer Detection:** Specifically measures whether vocabulary and grammar rules mastered in controlled practice exercises successfully transfer into unscripted, spontaneous speaking scenarios.
* **Anomaly & Failure Filtering:** Automatically screens out session anomalies (e.g., mic dropouts, single-word turns) to protect long-term progress trends from score corruption.

---

### ⚡ 6. Risk-Aware Provider Router & Resilience Architecture
To guarantee maximum uptime and zero unexpected operating costs:
* **Task-Risk Taxonomy:** Classifies operations into risk tiers (CRITICAL, HIGH, MEDIUM, LOW, DETERMINISTIC). High-risk tasks (e.g. grammar feedback) pass through strict verifier gates, while low-risk tasks utilize high-throughput free models.
* **Free-First Enforcement (`FREE_ONLY_MODE=true`):** Multi-provider routing architecture supporting HuggingFace, Cerebras, Groq, Gemini, OpenRouter, and local fallbacks. If external providers are unavailable, the system safely falls back without interrupting the user session.
* **Audio Privacy & Safety:** In-memory audio buffers are zeroed out immediately after processing, redacting raw audio binaries from system logs.

---

## 🛠️ Setup & Operations

### Environment Configuration (`.env`)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eloq_ai_dev"
FREE_ONLY_MODE="true"
PRIMARY_LLM_PROVIDER="gemini"
FALLBACK_LLM_PROVIDER="cerebras"
```

### Installation & Test Suite Execution

```bash
# 1. Install dependencies
npm install

# 2. Database migration & Prisma setup
npx prisma generate
npx prisma db push

# 3. Typecheck, Lint & Full Test Suite (209 unit & integration tests)
npm run typecheck
npm run lint
npm run test
```

---

## 📄 License
MIT License. Built for speech mastery, linguistic precision, and spontaneous fluency.
