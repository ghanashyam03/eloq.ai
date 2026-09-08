# Database Architecture & Domain Persistence Guide

## Overview

The database design for the AI English-Learning Platform is built around the fundamental architectural principle of **Raw Evidence Preservation**.

Rather than discarding user speech transcripts and error records after computing a single summary score, the database immutably preserves raw conversation turns, STT timing metrics, specific error occurrences, practice attempts, and unmixed performance metrics.

---

## 1. Why Raw Evidence is Preserved

1. **Algorithm Evolution**: As linguistic analysis models and CEFR evaluation prompts improve over time, historical user raw evidence can be re-analyzed without loss of original data.
2. **Detailed User Progress Tracing**: Enables exact answering of questions such as:
   - *What exact sentence did the user say on Tuesday?*
   - *How many times has the prepositions error occurred across 10 conversations?*
   - *Did the user's WPM or pause count improve over the last 30 days?*
3. **Evidence-Based Masteries**: User mastery scores for grammar skills and vocabulary items are derived from actual attempt counts and sample sizes rather than single AI estimates.

---

## 2. Entity Relationship Overview

```
User (1) ─── (1) UserProfile
User (1) ─── (*) LearningGoal
User (1) ─── (*) Conversation (1) ─── (*) ConversationTurn (1) ─── (*) SpeechSegment
                                              │
                                              ├─── (*) ErrorOccurrence ─── (1) ErrorDefinition
                                              └─── (*) PracticeAttempt ─── (1) PracticeExercise
User (1) ─── (*) UserGrammarSkill ─── (1) GrammarSkill
User (1) ─── (*) UserVocabularyItem ─── (1) VocabularyItem
User (1) ─── (*) PracticeSession ─── (*) PracticeAttempt
User (1) ─── (*) PerformanceMetric
User (1) ─── (*) LearningEvent (Immutable Audit Log)
User (1) ─── (*) ScoreRecord (Multi-dimensional Scores)
```

---

## 3. Core Entities

| Table | Entity | Description |
| :--- | :--- | :--- |
| `users` | User | Core identity and timestamps. |
| `user_profiles` | UserProfile | Target variety, estimated CEFR level, correction intensity, difficulty. |
| `learning_goals` | LearningGoal | Granular user goals with priority weights. |
| `conversations` | Conversation | Session mode (`free_chat`, `roleplay`, `debate`), difficulty, duration. |
| `conversation_turns` | ConversationTurn | Deterministic `turnOrder` sequence, speaker (`user`, `assistant`), text, audio URL. |
| `speech_segments` | SpeechSegment | Speech metrics per turn: audio duration, word count, pause count, pause duration, STT confidence. |
| `error_definitions` | ErrorDefinition | Canonical taxonomy of recurring errors (`ARTICLE_MISSING`, `PREPOSITION_INCORRECT`). |
| `error_occurrences` | ErrorOccurrence | Raw evidence linking an `ErrorDefinition` to a specific turn, original text, correction, explanation. |
| `grammar_skills` | GrammarSkill | Canonical taxonomy of English grammar topics. |
| `user_grammar_skills` | UserGrammarSkill | User mastery tracking (`estimatedMastery`, `confidence`, `totalAttempts`, `successes`, `failures`). |
| `vocabulary_items` | VocabularyItem | Dictionary reference table (`word`, `lemma`, `definition`, `partOfSpeech`, `IPA`, `synonyms`). |
| `user_vocabulary_items` | UserVocabularyItem | Mandatory distinction between **passive** (recognized) vs. **active** (produced) vocabulary. |
| `practice_sessions` | PracticeSession | User practice runs. |
| `practice_exercises` | PracticeExercise | Exercises targeting specific skills or errors. |
| `practice_attempts` | PracticeAttempt | Raw attempt responses, correctness, and feedback. |
| `performance_metrics` | PerformanceMetric | Raw unmixed speech metrics (WPM, filler count, pause count, vocabulary diversity TTR). |
| `learning_events` | LearningEvent | Immutable audit trail for analytics. |
| `score_records` | ScoreRecord | Multi-dimensional scores (`grammar`, `vocabulary`, `fluency`, `pronunciation`) with evidence counts. |

---

## 4. Mandatory Invariants & Rules

1. **Turn Ordering**: `ConversationTurn` enforces a unique composite constraint `[conversationId, turnOrder]`. Turn sequences are strictly deterministic.
2. **Active vs. Passive Vocabulary**:
   - `passive`: Word recognized in context.
   - `active`: Word successfully produced by the user in speech/writing $\ge 3$ times with low misuse.
   - `mastered`: Word produced $\ge 10$ times with zero misuse.
3. **No Blind JSON Blobs**: Queryable concepts (e.g. error category, turn order, timestamps, WPM) have explicit indexed columns. JSON is reserved strictly for provider-specific raw metadata (e.g. STT timing arrays, collocations).

---

## 5. User Privacy & Deletion Behavior

- All user-owned tables use `onDelete: Cascade` referencing `User.id`.
- When a user requests data deletion, deleting the `User` record automatically and completely wipes all conversations, turns, speech timing, error evidence, practice attempts, performance metrics, and learning events.
- Shared canonical reference data (`ErrorDefinition`, `GrammarSkill`, `VocabularyItem`) is preserved independently.

---

## 6. Indexing Strategy

Targeted composite indexes optimize high-frequency query paths:
- `[userId, startedAt]` / `[userId, createdAt]`: Timeline & analytics queries.
- `[conversationId, turnOrder]`: Fast deterministic turn fetching.
- `[userId, errorDefinitionId]`: Querying specific error occurrence history.
- `[userId, vocabularyItemId]`: Quick vocabulary lookup.
- `[userId, grammarSkillId]`: Quick grammar mastery lookup.
- `[userId, status]`: Active/Passive vocabulary filtering.
