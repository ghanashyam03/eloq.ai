# English Linguistic Analysis Engine Guide

## Overview

The **English Linguistic Analysis Engine** (`EnglishAnalysisService`) evaluates user English utterances to identify genuine linguistic issues while strictly minimizing false positives. The core objective is **accuracy over error quantity**—the user must never be taught incorrect English due to aggressive or inaccurate AI flagging.

```
User Utterance
  ↓
Deterministic Statistics Engine (DeterministicAnalyzer) -> WPM, TTR, Fillers, Word/Sentence Counts
  ↓
Pass 1: Candidate Detection (englishAnalysis.v1 Prompt via ModelRouter)
  ↓
Pass 2: Conservative Verification Filtering (IssueVerifier) -> Rejects False Positives & Variant Differences
  ↓
Confidence Threshold Partitioning (High >= 0.85, Medium 0.60-0.85, Low < 0.60 Filtered)
  ↓
Validated Structured Output (StructuredLinguisticAnalysis)
```

---

## 1. Classification Taxonomy (6 States)

Every evaluated utterance or candidate issue is assigned one of 6 classification states:
1. `grammatically_incorrect`: Factual syntax or morphological rule breakdown (e.g., *"She go to market yesterday"*).
2. `unnatural_phrase`: Grammatically valid syntax but non-idiomatic phrasing (e.g., *"I am having a doubt"* -> preferred *"I have a question"*).
3. `grammatically_correct_and_natural`: Fully valid and standard English.
4. `informal_valid`: Acceptable conversational speech (e.g., *"Gotta go now, catch ya later"*). Never flagged as a grammar error.
5. `dialect_variant_valid`: Valid regional variation (e.g., British *"at the weekend"*, *"flat"*, *"colour"* vs. American *"on the weekend"*, *"apartment"*, *"color"*).
6. `ambiguous_uncertain`: Ambiguous phrasing where the intent is unclear.

---

## 2. Categories & Subcategories

- **`GRAMMAR`**: `tense`, `article`, `preposition`, `subject_verb_agreement`, `pronoun`, `determiner`, `word_order`, `modal`, `conditional`, `conjunction`, `clause`, `agreement`.
- **`VOCABULARY`**: `incorrect_word`, `misuse`, `repetition`, `vague_word`, `inappropriate_register`, `collocation`.
- **`NATURALNESS`**: `awkward_phrase`, `unnatural_construction`, `literal_translation`, `excessive_formality`, `excessive_informality`.
- **`FLUENCY`**: `filler`, `hesitation`, `self_correction`, `fragmented_speech`.
- **`COHERENCE`**: `unclear_structure`, `weak_transition`, `incomplete_explanation`, `topic_discontinuity`.

---

## 3. False Positive Prevention & 2-Pass Verification

1. **Pass 1 Candidate Extraction**: Prompt `englishAnalysis.v1` instructs the model to detect candidate issues and assign individual confidence values (0.0 to 1.0) and severity ratings (1 to 5).
2. **Pass 2 Conservative Verification**: `IssueVerifier` checks candidates against:
   - Regional dialect dictionaries (US, UK, AU).
   - Valid informal phrase lists (`gotta`, `gonna`, `wanna`, `catch ya later`).
   - Confidence cutoff: Candidates with confidence $< 0.60$ are rejected.
3. **Threshold Filtering**:
   - **High Confidence ($\ge 0.85$)**: Surfaced prominently.
   - **Medium Confidence ($0.60 \le c < 0.85$)**: Shown cautiously.
   - **Low Confidence ($< 0.60$)**: Filtered out completely.

---

## 4. Deterministic Non-LLM Analytics (`DeterministicAnalyzer`)

Simple arithmetic and statistical metrics are calculated deterministically without wasting LLM tokens:
- Exact word count & sentence count.
- Type-Token Ratio (TTR) for vocabulary diversity.
- Known filler counts (`uh`, `um`, `er`, `like`, `you know`, `i mean`).
- Speech WPM and pause duration (from raw STT timing metadata).
