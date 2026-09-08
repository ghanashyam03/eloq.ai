# Speech & Audio Infrastructure Guide

## Overview

The **Speech & Audio Infrastructure** provides reliable, provider-agnostic voice capabilities for the AI English-learning platform. It manages client-side microphone capture, pre-provider payload validation, ephemeral privacy-first processing, server-side Speech-To-Text (STT) and Text-To-Speech (TTS) abstractions, interruption control, and end-to-end integration with the `ConversationService`.

```
Microphone Audio Capture (src/lib/audio/audio-recorder.ts)
  ↓
Payload & MIME Validation (src/lib/audio/audio-validator.ts)
  ↓ Ephemeral Upload via HTTP POST /api/speech/stt
STT Provider (Hugging Face Whisper / Web Speech / Mock)
  ↓ Normalized Transcript (fullText, confidence, duration)
Conversation Engine (src/server/services/conversation-service.ts)
  ↓ Assistant Response Turn
TTS Synthesis & Interruption Player (src/lib/audio/tts-player.ts)
```

---

## 1. Client Audio Recorder (`AudioRecorder`)

Located at `src/lib/audio/audio-recorder.ts`:

- Framework-agnostic `MediaRecorder` state machine (`idle` -> `recording` -> `stopped` / `cancelled`).
- Methods: `start()`, `stop()`, `cancel()`, `getDurationSeconds()`, `getStatus()`.
- Error taxonomy: `permission_denied`, `microphone_unavailable`, `browser_unsupported`, `recording_failed`.

---

## 2. Pre-Provider Audio Validation

Located at `src/lib/audio/audio-validator.ts`:

Blocks malformed or oversized uploads before reaching external STT providers:
- **Max Payload Size**: 25 MB.
- **Max Audio Duration**: 300 seconds (5 minutes).
- **Supported Formats**: `audio/webm`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/m4a`.
- **Empty Payload Protection**: Throws typed `AppError.validation` if audio buffer is 0 bytes.

---

## 3. Ephemeral Audio Privacy Lifecycle

By default:
1. Client records audio locally in browser memory.
2. Audio payload is transmitted via `/api/speech/stt`.
3. Server processes the audio buffer in-memory through the STT provider.
4. Server extracts normalized transcript text.
5. **Raw audio buffer is discarded immediately** and garbage collected. Raw audio is **never** permanently stored in the database by default.

---

## 4. STT & TTS Provider Abstractions

- **STT Interface (`STTProvider`)**: Accepts audio buffer and MIME type; returns normalized `STTTranscriptionResult` (`fullText`, `confidence`, `durationSeconds`, `segments`, `words`).
  - Implementations: `HuggingFaceSTTProvider` (Whisper), `MockSTTProvider`.
- **TTS Interface (`TTSProvider`)**: Accepts text string; returns synthesized audio buffer and MIME content-type.
  - Implementations: `MockTTSProvider`.
- **Client TTS Player (`TTSPlayer`)**: Controls audio playback and supports **instant interruption** (`cancelPlayback()`) when the user starts speaking.

---

## 5. Security & Credentials Isolation

- Browser code captures raw audio without access to any API secret keys.
- Secret credentials (`HF_TOKEN`, `CEREBRAS_API_KEY`) remain strictly server-side inside API routes (`/api/speech/stt`, `/api/speech/tts`).
