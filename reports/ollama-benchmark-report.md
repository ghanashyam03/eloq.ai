# Local Ollama English Analysis Benchmark

**Provider**: local-ollama (http://localhost:11434/v1)  
**Model**: llama3.2:1b  
**Benchmark version**: v2  
**Timestamp**: 2026-09-08T02:02:55.176Z  
**Configuration**: temperature=0.1, maxRequestsCap=50  

---

## Benchmark Metrics

| Metric | Value |
|---|---|
| **Total Cases** | 30 |
| **Evaluated Requests** | 1 / 50 |
| **Passed Cases** | 0 |
| **Failed Cases** | 1 |
| **Overall Accuracy** | 0.0% |
| **Precision (Error Detection)** | 0.0% |
| **Recall (Error Detection)** | 0.0% |
| **F1 Score** | 0.0% |
| **False Positive Rate** | 0.0% |
| **False Negative Rate** | 100.0% |
| **Schema Validity Rate** | 0.0% |
| **Average Latency** | 1008 ms |
| **Median Latency** | 1008 ms |
| **Maximum Latency** | 1008 ms |

---

## Quota & Failure Safeguard Status

- **Stopped On Failure**: true
- **Stop Reason**: Local Ollama Provider failed on test case TC-01: ECONNREFUSED connecting to http://localhost:11434/v1

---

## Confidence Calibration

| Confidence Bucket | Evaluated Count | Passed Count | Accuracy |
|---|---|---|---|
| **0.0 - 0.2** | 1 | 0 | 0.0% |
| **0.2 - 0.4** | 0 | 0 | 0.0% |
| **0.4 - 0.6** | 0 | 0 | 0.0% |
| **0.6 - 0.8** | 0 | 0 | 0.0% |
| **0.8 - 1.0** | 0 | 0 | 0.0% |

---

## Failure Analysis

### Test Case TC-01
- **Input**: "I have went there yesterday."
- **Expected**: isCorrect=false (grammar_error)
- **Actual**: isCorrect=false, state=PROVIDER_ERROR, issues=0
- **Category**: `provider_failure`
- **Confidence**: 0
- **Explanation**: ECONNREFUSED connecting to http://localhost:11434/v1


---

## Recommendations

> [!WARNING]
> **Execution Stopped**: Local Ollama Provider failed on test case TC-01: ECONNREFUSED connecting to http://localhost:11434/v1.
