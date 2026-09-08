# Recurring-Error & Personal Weakness Detection Engine Guide

## Overview

The **Recurring-Error & Personal Weakness Detection Engine** (`WeaknessProfileService`) converts individual linguistic observations (detected by `EnglishAnalysisService` and recorded in the database) into longitudinal user learning knowledge.

It answers the core product question:
> **"What English problems does this user repeatedly struggle with over time?"**

```
Raw Error Occurrences (error_occurrences DB table)
  ↓
Error Normalizer (ErrorNormalizer) -> Canonical Pattern & Normalized Key Signature
  ↓
Deterministic Weakness Calculator (WeaknessCalculator)
  ├── Multi-factor Priority Score Formula (Frequency, Severity, Recency, Confidence, Goals)
  ├── Deterministic Trend Classification (Improving, Stable, Worsening, Insufficient Evidence)
  ├── Active/Passive Mastery Estimation (Attempt Ratio, Spontaneous vs Controlled, Recency Decay)
  └── Relapse State Machine (Active <-> Improving <-> Mastered <-> Relapsed)
  ↓
User Weakness Profile (WeaknessProfileService) -> Evidence-backed profile with sample examples
```

---

## 1. Separation of Responsibilities

- **`EnglishAnalysisService`**: Evaluates a single utterance and detects individual error occurrences.
- **`WeaknessProfileService`**: Aggregates longitudinal historical occurrences over time into normalized weakness signatures, calculates priorities, trends, and mastery, and produces the user's personal weakness profile.

---

## 2. Error Normalization & Signatures (`ErrorNormalizer`)

Surface variations of the same underlying mistake are normalized into a single canonical key signature:

- *"I am interested on astronomy."*
- *"I am interested on physics."*
- *"I am interested on mathematics."*

All map to:
- **Canonical Pattern**: `interested in`
- **Normalized Key**: `grammar:preposition:interested_in` (or explicit code key `grammar:preposition:preposition_incorrect`)

---

## 3. Purely Deterministic Calculations (`WeaknessCalculator`)

Zero LLM calls are used for arithmetic, counts, recency decays, mastery estimates, or trend detection. All metrics are calculated deterministically:

### Priority Score Formula
$$\text{Priority} = \left(\text{Count} \times 0.35 + \text{AvgSeverity} \times 0.25 + \text{RecencyWeight} \times 0.20 + \text{GoalWeight} \times 0.20\right) \times \text{AvgConfidence} \times \text{TrendMultiplier}$$

### Trend Classification Rules
- Requires a **minimum sample size of 3** occurrences before assigning directional trends.
- If sample size $< 3$, status is `insufficient_evidence`.
- Compares recent vs. past occurrence rates over time: `improving`, `stable`, or `worsening`.

### Mastery Estimation Formula
- Spontaneous conversation successes carry **1.5x weight** over controlled practice exercises.
- Incorporates attempt volume, success/failure ratio, and recency decay for demonstrations older than 30 days.

---

## 4. Relapse & Recovery State Machine

```
Active ─── (Mastery >= 85% & 0 Recent Errors) ───> Mastered
  │                                                    │
  │                                         (New Error Occurrences)
  ▼                                                    │
Improving <───────────────────────────────────────── Relapsed
```

- When a user demonstrates correct usage, their weakness priority decreases and mastery increases without deleting historical data.
- If errors reoccur later, the state transitions from `mastered` to `relapsed` while preserving the complete historical evidence audit log.

---

## 5. Personal Weakness Profile Output

`generateWeaknessProfile(userId)` partitions findings into evidence-backed buckets:
- `topWeaknesses`: Highest priority active/relapsed weaknesses.
- `topImprovingSkills`: Skills with positive trend and increasing mastery.
- `persistentWeaknesses`: Long-standing recurring weaknesses across multiple sessions.
- `recentlyEmergingWeaknesses`: Newly detected recurring errors within the last 30 days.
- `relapsedWeaknesses`: Previously mastered skills with new error occurrences.
