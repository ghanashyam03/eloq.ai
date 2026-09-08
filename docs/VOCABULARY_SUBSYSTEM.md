# Vocabulary Intelligence Subsystem Architecture

## Overview

The Vocabulary Intelligence Subsystem converts passive vocabulary recognition into active, natural communication mastery. It tracks a learner's progression through 5 distinct mastery stages, extracts high-value candidate words with collocations from user interactions, generates active retrieval exercises, evaluates response naturalness, and schedules deterministic Spaced Repetition System (SRS) reviews.

---

## 1. 5-Stage Vocabulary State Machine

The subsystem models user vocabulary acquisition across 5 sequential states:

```
[Encountered] ──> [Recognized] ──> [Passive] ──> [Active] ──> [Mastered]
```

1. **`encountered`**: The user has seen or heard the word in conversation or reading material ($0$ successful productions, $< 2$ recognitions).
2. **`recognized`**: The user correctly recognized the word in context at least once or twice, but has not recalled or produced it independently.
3. **`passive`**: The user recognizes/recalls the word comfortably ($\ge 2$ recognitions, mastery $\ge 0.3$), but cannot consistently produce it in spontaneous speech or writing ($< 3$ correct productions).
4. **`active`**: The user has successfully produced the word in context at least 3 times, demonstrated natural usage at least once, and maintained mastery $\ge 0.5$.
5. **`mastered`**: The user has achieved high production fluency ($\ge 7$ correct productions, $\ge 3$ natural usages, mastery $\ge 0.8$, and $\ge 4$ consecutive SRS review successes).

---

## 2. Spaced Repetition Scheduler (SRS) Algorithm

The review scheduler operates on a modified SuperMemo (SM-2) algorithm customized for active language production.

### Review Type Weight Multipliers

Different review types carry distinct cognitive loads. Active production reviews carry significantly higher weight to accelerate active vocabulary retention:

| Review Type | Description | Weight Multiplier |
|---|---|---|
| `recognition` | Passive option selection in sentence context | `1.0x` |
| `recall` | Recalling definition or synonym | `1.2x` |
| `production` | Gap fill or target word production | `2.0x` |
| `contextual_production` | Sentence creation with collocation | `2.5x` |

### Ease Factor ($EF$) Calculation

For quality grade $q \in \{0, 1, 2, 3\}$:

$$EF' = \max\left(1.3, \min\left(3.5, EF + \left(0.1 - (3 - q) \times (0.08 + (3 - q) \times 0.02)\right)\right)\right)$$

### Interval Calculation ($I$)

- **Grade 0 (Incorrect)**: `consecutiveSuccesses = 0`, $I = 1$ day.
- **Grade $\ge 1$ (Successful Attempt)**:
  - `consecutiveSuccesses` incremented by 1.
  - $n = 1$: $I = 1$ day.
  - $n = 2$: $I = \max(2, \text{round}(3 \times \text{weight}))$.
  - $n > 2$: $I = \min(365, \text{round}(I_{\text{prev}} \times EF \times \text{weight}))$.

---

## 3. Response Naturalness Evaluation

When evaluating active retrieval exercises, the subsystem distinguishes between three performance ratings:

1. **`incorrect` (Grade 0, Score 0.0)**: Target word is missing, severely misspelled, or misused out of context.
2. **`correct_unnatural` (Grade 1, Score 0.65)**: Target word is present, but used without its natural collocation, awkwardly phrased, or in a clipped fragment.
3. **`correct_natural` (Grade 3, Score 1.0)**: Target word is fluently incorporated alongside its natural collocation (e.g. *"mitigate risk"*).

---

## 4. Normalization & Lexical Enrichment

- **Normalization**: Lowercases, strips punctuation, and removes common English stop words.
- **Lemmatization**: Maps inflected forms (`running` $\rightarrow$ `run`, `studies` $\rightarrow$ `study`, `better` $\rightarrow$ `good`) via irregular dictionary lookups and rule-based suffix algorithms.
- **Lexical Metadata**: Authoritative dictionary entries set `isModelGenerated: false` and include curated collocations, IPA pronunciation, register, and example sentences. Model-generated entries flag `isModelGenerated: true`.
