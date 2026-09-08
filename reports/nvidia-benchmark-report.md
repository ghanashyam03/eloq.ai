# NVIDIA English Analysis Benchmark

**Provider**: nvidia  
**Model**: nvidia/nemotron-3-super-120b-a12b  
**Benchmark version**: v2  
**Timestamp**: 2026-09-08T02:02:56.205Z  
**Configuration**: temperature=0.1, maxRequestsCap=50  

---

## Benchmark Metrics

| Metric | Value |
|---|---|
| **Total Cases** | 30 |
| **Evaluated Requests** | 30 / 50 |
| **Passed Cases** | 16 |
| **Failed Cases** | 14 |
| **Overall Accuracy** | 53.3% |
| **Precision (Error Detection)** | 0.0% |
| **Recall (Error Detection)** | 0.0% |
| **F1 Score** | 0.0% |
| **False Positive Rate** | 0.0% |
| **False Negative Rate** | 100.0% |
| **Schema Validity Rate** | 100.0% |
| **Average Latency** | 0 ms |
| **Median Latency** | 0 ms |
| **Maximum Latency** | 1 ms |

> **Note on Baseline Comparison**:  
> Existing Gemini 9-case smoke-test result: 88.9%, not directly comparable (evaluated on a separate 9-case smoke test vs this 30-case benchmark).

---

## Quota & Failure Safeguard Status

- **Stopped On Failure**: false
- **Stop Reason**: None (Completed cleanly)

---

## Confidence Calibration

| Confidence Bucket | Evaluated Count | Passed Count | Accuracy |
|---|---|---|---|
| **0.0 - 0.2** | 0 | 0 | 0.0% |
| **0.2 - 0.4** | 0 | 0 | 0.0% |
| **0.4 - 0.6** | 0 | 0 | 0.0% |
| **0.6 - 0.8** | 0 | 0 | 0.0% |
| **0.8 - 1.0** | 30 | 16 | 53.3% |

---

## Failure Analysis

### Test Case TC-01
- **Input**: "I have went there yesterday."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-02
- **Input**: "She don't like the idea."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-03
- **Input**: "He go to university every day."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-08
- **Input**: "I am interested on astronomy."
- **Expected**: isCorrect=false (collocation_issue)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-09
- **Input**: "It depends of the weather."
- **Expected**: isCorrect=false (collocation_issue)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-11
- **Input**: "He is very good in playing chess."
- **Expected**: isCorrect=false (collocation_issue)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-12
- **Input**: "She has been working here since three years."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-14
- **Input**: "I saw an European movie last night."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-15
- **Input**: "She goes to school by the bus."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-16
- **Input**: "The list of items are on the desk."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-17
- **Input**: "Can you tell me where is the station?"
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-18
- **Input**: "If I would have known, I would have called you."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-28
- **Input**: "Um, yesterday I have seen him at the coffee shop near office."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean

### Test Case TC-30
- **Input**: "Well, uh, the people in the office is working very hard today."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=true, state=grammatically_correct_and_natural, issues=0
- **Category**: `false_negative`
- **Confidence**: 0.9
- **Explanation**: Clean


---

## Recommendations

1. **Linguistic Accuracy**: Model achieved 53.3% accuracy across 30 deterministic test cases.
2. **False Positive Guardrail**: False positive rate is 0.0%.
3. **Spoken English Handling**: Evaluated 8 spontaneous spoken sentences containing fillers (*um*, *uh*) and self-corrections.
