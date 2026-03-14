# Fair Evaluation Report: GATeR vs TARGET
**Generated**: 20260309_030449

## 1. Evaluation Protocol

### Why This Evaluation Is Fair
| Concern | Resolution |
|---------|------------|
| **Dataset size mismatch** (TARGET: 7,103 vs GATeR: 300 custom) | Both systems evaluated on the **same** stratified sample of **100** TaRBench test cases |
| **Exact Match bias** | EM is reported as *informational only*; primary comparison uses paradigm-agnostic BLEU, CodeBLEU, and Plausible Rate |
| **Paradigm difference** (supervised vs RAG) | Metrics chosen measure *output quality*, not training methodology |

### Sampling Details
- **Source**: TaRBench test split (7,103 cases, 59 projects)
- **Sample size**: 100
- **Random seed**: 42 (reproducible)
- **Stratification**: verdict type × trivial flag × project diversity
- **Verdict distribution in sample**: {"failure": 23, "compile_error": 77}
- **Projects represented**: 34 — Alluxio/alluxio, Cornutum/tcases, SonarOpenCommunity/sonar-cxx, Stratio/cassandra-lucene-index, apache/flink, apache/shardingsphere, arouel/uadetector, biojava/biojava, cucumber/cucumber-jvm, damianszczepanik/cucumber-reporting...

## 2. Results

| Metric | GATeR (RAG) | TARGET (Fine-tuned) | Category |
|--------|-------------|---------------------|----------|
| BLEU | N/A | 61.11 | Fair |
| CodeBLEU | N/A | 0.01 | Fair |
| Compilation Success % | N/A | 81.00 | Fair |
| Plausible Repair Rate % | N/A | 88.00 | Fair |
| Exact Match % | N/A | 64.00 | Informational* |
| Exact Match (beam) % | N/A | 65.00 | Informational* |
| Repair Attempt Rate % | N/A | 100.00 | Analysis |
| Line-Level Accuracy % | N/A | 0.00 | Analysis |
| Avg Edit Similarity % | N/A | 89.33 | Analysis |

*\*Informational: Exact Match inherently favors supervised fine-tuned models because they learn the target distribution. GATeR generates novel repairs that may be functionally correct but syntactically different.*

## 3. Metric Definitions

| Metric | Definition | Paradigm Bias |
|--------|------------|---------------|
| **BLEU** | Corpus-level n-gram overlap between predicted and ground-truth repair lines | None — text similarity |
| **CodeBLEU** | Weighted combination of n-gram, keyword, syntax-tree, and data-flow match | None — code similarity |
| **Compilation Success** | % of predictions passing basic Java syntax validation | None — structural correctness |
| **Plausible Repair Rate** | % of test cases where at least one candidate repair compiles and passes the test when executed | None — **functional correctness** (the gold standard) |
| **Exact Match** | % where prediction string-matches ground truth exactly | **High** — favors supervised models trained on (input, output) pairs |
| **Line-Level Accuracy** | % of individual changed lines present in prediction | Low |
| **Avg Edit Similarity** | Normalised Levenshtein similarity to ground truth | Low |

## 4. Why Exact Match Favors TARGET

TARGET is a **supervised fine-tuned** model (CodeT5+) trained on 36,639 (input, output) pairs from TaRBench.
It learns to reproduce the *exact distribution* of ground-truth repairs.
A high EM score is expected and directly reflects its training objective.

GATeR is a **RAG-based zero-shot** system: it retrieves context from a Knowledge Graph and generates repairs
via an LLM (DeepSeek Coder 6.7B) **without** training on any repair pairs.
Its repairs may be *functionally correct* but syntactically different from the ground truth.
Penalising GATeR on EM would be like grading an essay on whether it matches the answer key word-for-word.

**Recommended primary metrics**: BLEU, CodeBLEU, Plausible Repair Rate.

## 5. Reference: TARGET on Full TaRBench

For context, TARGET's published results on the **full** 7,103 test set:
- Exact Match: 66.08%
- Plausible Rate: 80.04%
- Beam size: 40

## 6. Reproduction

```bash
# Run with default 500-case sample:
python -m evaluation.run_fair_evaluation

# Custom sample size:
python -m evaluation.run_fair_evaluation --sample-size 1000 --seed 42

# Skip GATeR run (only compute TARGET metrics on the subset):
python -m evaluation.run_fair_evaluation --skip-gater-run
```
