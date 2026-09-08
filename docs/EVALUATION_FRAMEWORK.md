# Evaluation and Measurement Framework Architecture

## Overview

The Evaluation and Measurement Framework provides reproducible, evidence-driven benchmarking for the English-learning platform. It strictly eliminates subjective LLM self-grading (*"Was this good?"*) in favor of empirical statistical formulas calculated against annotated gold-standard test datasets.

---

## 1. Core Evaluation Philosophy & Metrics

Accuracy and false positive prevention are paramount. Teaching a learner incorrect corrections destroys user trust and reinforces bad linguistic habits.

### Deterministic Metrics Formulas

- **Precision**: $\text{Precision} = \frac{TP}{TP + FP}$ (Target $\ge 90.0\%$)
- **Recall**: $\text{Recall} = \frac{TP}{TP + FN}$ (Target $\ge 85.0\%$)
- **F1 Score**: $F_1 = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$ (Target $\ge 87.0\%$)
- **False Positive Rate (FPR)**: $\text{FPR} = \frac{FP}{FP + TN}$ (Target $\le 5.0\%$)
- **False Negative Rate (FNR)**: $\text{FNR} = \frac{FN}{FN + TP}$ (Target $\le 15.0\%$)
- **Accuracy**: $\text{Accuracy} = \frac{TP + TN}{\text{Total Cases}}$

---

## 2. Confidence Calibration & Expected Calibration Error ($ECE$)

The engine buckets predictions into 5 confidence intervals ($[0.0\text{--}0.2]$, $[0.2\text{--}0.4]$, $[0.4\text{--}0.6]$, $[0.6\text{--}0.8]$, $[0.8\text{--}1.0]$) to verify whether high-confidence predictions are empirically more accurate.

### Expected Calibration Error ($ECE$) Formula

$$ECE = \sum_{b=1}^{B} \frac{N_b}{N} |\text{acc}(b) - \text{conf}(b)|$$

---

## 3. Multi-dimensional Score Model & Versioning

### Raw vs. Derived Data Separation
- **Raw Measurements**: Immutably stored turn-level counts (e.g. `wordsPerMinute`, `fillerCount`, `pauseCount`, `errorFrequencyRate`, `typeTokenRatio`).
- **Derived Scores**: Calculated by versioned scoring algorithms (`speakingScore.v1`, `grammarScore.v1`, `vocabularyScore.v1`).

### Minimum Evidence Sample Size Threshold ($N \ge 3$)
If the total number of observations for a user dimension is $< 3$, the engine explicitly returns:
```json
{
  "value": null,
  "hasEnoughEvidence": false,
  "statusText": "Insufficient evidence (requires minimum 3 evidence items)"
}
```
This guarantees the system never fabricates false certainty from sparse data.

---

## 4. Prompt Versioning & Regression Tracking

When prompt versions (e.g. `englishAnalysis.v1` $\rightarrow$ `englishAnalysis.v2`) or underlying LLM providers (e.g. HuggingFace $\rightarrow$ Cerebras) are updated, the evaluation suite executes automatically and produces a delta report highlighting precision, recall, and FPR changes.

---

## 5. Known Limitations & Defense Mechanisms

1. **Slang & Regional Dialect Noise**: Informal speech and dialect variants (e.g. AAVE, Singlish) may exhibit elevated false positive rates if regional context is not specified.
2. **Speech Recognition Transcripts**: Microphone STT transcription errors (e.g. homophones or dropped endings) can trigger downstream grammar false positives.
3. **Hosted API Rate Limits**: Free hosted inference tiers enforce strict concurrency limits, requiring provider fallback routing via `ModelRouter`.
