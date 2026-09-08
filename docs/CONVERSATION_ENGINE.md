# Conversation Intelligence Engine Architecture

## Overview

The **Conversation Intelligence Engine** (`ConversationService`) manages the interactive conversational feedback loop between the user and the AI assistant. It is implemented as a server-side, framework-agnostic domain service completely decoupled from React and presentation UI layers.

```
User Turn Text
  ↓
processUserTurn() -> Persist User Turn to DB
  ↓
generateAssistantTurn() -> ContextBuilder (Selective Context Retrieval)
  ↓
buildConversationPromptV1 (conversation.v1 Prompt Template)
  ↓
ModelRouter (Task Routing, Retries, Fallback) -> AI Provider
  ↓ Output Validation & Sanitization
Persist Assistant Turn to DB -> Return ConversationTurnResult
```

---

## 1. Core API (`ConversationService`)

Located at `src/server/services/conversation-service.ts`:

- `startConversation(userId, options)`: Initializes a new conversation session with specified mode and difficulty.
- `processUserTurn(conversationId, userText)`: Validates user input, computes deterministic turn sequence numbers, and persists turn evidence to the database.
- `generateAssistantTurn(conversationId, options)`: Assembles bounded context, invokes `ModelRouter`, cleanses response content, and persists assistant turn.
- `generateAssistantStream(conversationId, options)`: Asynchronously streams response deltas to the caller while buffering content to persist upon completion.
- `endConversation(conversationId)`: Concludes conversation session and logs total duration.

---

## 2. Selective Bounded Context Builder (`ContextBuilder`)

Located at `src/server/services/context-builder.ts`:

Rather than dumping the user's entire lifetime history or database into LLM prompts, `ContextBuilder` selectively retrieves:
1. **Bounded Turn Window**: Last $N=10$ conversation turns (prevents token context window exhaustion).
2. **Top Active Learning Goals**: Max 3 priority goals.
3. **Top 3 Recurring Weaknesses**: Extracted from historical error occurrences.
4. **Target Vocabulary**: Top active vocabulary words to reinforce naturally.

---

## 3. Versioned System Prompt Templates (`conversation.v1`)

Located at `src/server/prompts/conversation.v1.ts`:

- Version identifier: `conversation.v1`
- Directives:
  - **Natural Conversation First**: Responds as an engaging human conversational partner.
  - **No Gratuitous Praise**: Forbids generic superficial praise like *"Great job using past simple!"* unless evaluation is requested.
  - **Mode Adaptation**: Adjusts tone and style across 7 modes (`casual`, `free_conversation`, `academic`, `professional`, `interview`, `debate`, `roleplay`).
  - **Correction Styles**: Supports 4 correction modes (`natural`, `balanced`, `teacher`, `brutal`). Note: *"brutal"* means comprehensive direct feedback without insult or condescension.

---

## 4. Security & Prompt Injection Mitigation

User conversational input is treated as **untrusted data**:
- Incoming user content is framed inside explicit delimiters: `<UNTRUSTED_USER_INPUT> ... </UNTRUSTED_USER_INPUT>`.
- System instructions explicitly instruct the model to maintain its role as an English conversation partner and disregard user attempts to override rules or issue commands such as *"Ignore all previous instructions"*.

---

## 5. Failure Resilience & State Integrity

- Provider failures, timeouts, rate limits, or empty/malformed responses throw a typed `AppError`.
- **State Integrity Guarantee**: Failed or corrupted AI responses are **never** written to the database as valid assistant turns. The conversation history remains clean and ready for retry.
