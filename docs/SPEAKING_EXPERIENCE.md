# Real-Time Speaking Experience Architecture

## Overview

The Real-Time Speaking Experience provides a stateful, interruptible, cancellable, and accessible voice conversation system built on top of the platform's speech STT/TTS providers, conversation intelligence engine, and English analysis engine.

---

## 1. 11-State Session Machine

The session state machine enforces explicit state transitions without relying on loose boolean flags:

```
[IDLE] ──> [REQUESTING_MIC_PERMISSION] ──> [READY] ──> [RECORDING] ──> [TRANSCRIBING] ──> [THINKING] ──> [SPEAKING] ──> [COMPLETED]
                                               │            │               │              │
                                               v            v               v              v
                                         [INTERRUPTED] [INTERRUPTED]   [INTERRUPTED] [INTERRUPTED]
                                               │            │               │              │
                                               └────────────┴───────────────┴──────────────┴──> [RECORDING]
```

### States Breakdown

1. **`IDLE`**: Initial state before session initialization.
2. **`REQUESTING_MIC_PERMISSION`**: Prompting system/browser for microphone media stream access.
3. **`READY`**: Microphone active and awaiting user input.
4. **`RECORDING`**: Capturing user audio stream.
5. **`TRANSCRIBING`**: Sending audio Blob to STT provider for transcription.
6. **`THINKING`**: Assembling conversation context and generating assistant turn.
7. **`SPEAKING`**: Synthesizing and playing assistant TTS audio.
8. **`INTERRUPTED`**: User barge-in triggered during TTS playback or thinking.
9. **`PAUSED`**: User temporarily paused session.
10. **`ERROR`**: Non-recoverable error encountered (resets gracefully to `READY`).
11. **`COMPLETED`**: Session ended naturally.

---

## 2. Barge-In Interruption Protocol

If the AI is in `SPEAKING` state and the user begins speaking or clicks record:

1. `TTSPlayer.cancelPlayback()` halts audio output immediately.
2. `SpeakingPipelineOrchestrator.interruptCurrentTurn()` aborts in-flight turn tasks via `AbortController`.
3. State transitions to `INTERRUPTED` then `RECORDING`.
4. Turn history order is preserved (User $N$ $\rightarrow$ Assistant $N$ $\rightarrow$ User $N+1$).

---

## 3. Concurrency & Stale Response Protection

- Each turn request is assigned a unique `turnId`.
- Active requests hold an `AbortController`.
- If a user cancels or initiates a newer turn, older pending STT/LLM/TTS responses matching stale `turnId`s are discarded before UI render.

---

## 4. Technical Telemetry Tracker

The engine logs non-sensitive timing and outcome telemetry:

- **`sttLatencyMs`**: Time spent on audio transcription.
- **`llmLatencyMs`**: Time spent on assistant turn generation.
- **`ttsLatencyMs`**: Time spent on speech synthesis.
- **`totalTurnLatencyMs`**: End-to-end user turn duration.
- **`isCancelled`**: Whether the turn was interrupted or aborted.
- **`isSuccess`**: Empirical success status.

---

## 5. Partial Failure Recovery

- **TTS Failure**: If TTS fails after STT/LLM succeed, text response remains rendered on UI with a manual `Retry Audio` option.
- **Background Analysis Failure**: Asynchronous English analysis executes in background. If it fails, the conversation turn remains valid and `analysisStatus` is marked `failed` for retry.
