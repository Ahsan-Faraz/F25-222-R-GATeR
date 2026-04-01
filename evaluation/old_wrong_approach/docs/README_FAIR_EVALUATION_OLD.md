# Fair Evaluation Framework — GATeR vs TARGET

## The Problem

| Issue | Detail |
|-------|--------|
| **Dataset mismatch** | TARGET evaluated on 7,103 TaRBench test cases; GATeR on ~300 custom cases |
| **Metric bias** | Exact Match (EM) inherently favors supervised fine-tuned models |
| **Paradigm gap** | TARGET = supervised fine-tuning on repair pairs; GATeR = RAG + zero-shot LLM |

A panel cannot accept a comparison where the two systems are tested on different data using metrics that favor one paradigm.

---

## The Solution: Same Data, Fair Metrics

### Protocol

1. **Stratified sample** 500 test cases from TaRBench's official test split (7,103 cases, 59 Java projects).
2. **Run BOTH systems** on the exact same 500 cases.
3. **Evaluate with paradigm-agnostic metrics** — metrics that measure output quality, not training methodology.
4. **Report EM** separately as informational, with an explicit caveat about its bias.

### Metrics Matrix

| Metric | Measures | Bias | Role |
|--------|----------|------|------|
| **BLEU** | N-gram text overlap | None | Fair primary metric |
| **CodeBLEU** | Code-aware similarity (syntax + dataflow) | None | Fair primary metric |
| **Plausible Repair Rate** | Does the repair compile & pass the test? | None | **Gold standard** — functional correctness |
| **Compilation Success %** | Does generated code have valid syntax? | None | Fair primary metric |
| **Exact Match** | String-level identity with ground truth | **High** — favors supervised | Informational only |
| **Line-Level Accuracy** | Individual changed lines matching | Low | Analysis |
| **Avg Edit Similarity** | Levenshtein similarity to ground truth | Low | Analysis |

### Why This Is Fair

- **Same test set** eliminates dataset size bias.
- **BLEU / CodeBLEU** measure how close the repair is to the ground truth — they reward partially correct repairs rather than requiring exact reproduction.
- **Plausible Repair Rate** is the fairest metric: it tests whether the repaired test *actually works*, regardless of whether the exact same tokens were produced. A zero-shot RAG system and a fine-tuned model are on completely equal footing here.
- **EM is acknowledged as biased** because TARGET was trained on 36,639 similar (input, output) pairs — it *learned* to reproduce ground-truth tokens. GATeR never saw any training pairs.

---

## How to Run

```bash
# From the GATeR project root:

# Full evaluation (runs GATeR + computes TARGET metrics on the same subset):
python -m evaluation.run_fair_evaluation

# Custom sample size (1000 cases):
python -m evaluation.run_fair_evaluation --sample-size 1000

# Only compute TARGET metrics on the subset (skip GATeR if Ollama unavailable):
python -m evaluation.run_fair_evaluation --skip-gater-run

# Specify output directory:
python -m evaluation.run_fair_evaluation --output-dir evaluation/results
```

### Prerequisites

```bash
pip install nltk
python -c "import nltk; nltk.download('punkt')"
```

For CodeBLEU, TARGET's `fine-tuning/` directory must be accessible (the script auto-adds it to `sys.path`).

For running GATeR repairs, Ollama must be running with the DeepSeek Coder model:
```bash
ollama pull deepseek-coder:6.7b
ollama serve
```

---

## Output

Results are saved to `evaluation/results/`:

| File | Content |
|------|---------|
| `fair_evaluation_report_<timestamp>.md` | Full Markdown report with comparison table, methodology, and metric definitions |
| `fair_evaluation_results_<timestamp>.json` | Raw metric values for both systems |
| `sample_ids_<timestamp>.json` | The exact 500 IDs sampled (for reproducibility) |
| `gater_predictions_<timestamp>.json` | GATeR's repair outputs for each test case |

---

## Architecture

```
evaluation/
├── __init__.py
├── fair_eval_config.py        # Paths, sampling params, metric config
├── tarbench_bridge.py         # TaRBench ↔ GATeR format conversion
├── metrics.py                 # BLEU, CodeBLEU, EM, compilation check, etc.
├── run_fair_evaluation.py     # Main runner (CLI entry point)
└── README_FAIR_EVALUATION.md  # This file
```

### Data Flow

```
TaRBench (7,103 test cases)
        │
        ├── stratified_sample(500)
        │
        ├───────────────────────────────────────┐
        │                                       │
   tarbench_to_gater_input()          TARGET test_predictions.json
        │                                       │
   GATREngine.repair_test()           pick best beam prediction
        │                                       │
   GATeR repaired code                 TARGET repaired lines
        │                                       │
        └───────── compute_all_metrics() ───────┘
                          │
              Comparison Table + Report
```

---

## Addressing Panel Concerns

> "You can't compare 300 cases vs 45,000 cases."

**Fixed**: Both systems are now evaluated on the **same 500 cases** from TaRBench.

> "Exact Match doesn't apply to a RAG system."

**Fixed**: EM is reported as *informational only* with an explicit bias caveat.
Primary comparison uses BLEU, CodeBLEU, and Plausible Repair Rate — all paradigm-agnostic.

> "The two systems are fundamentally different."

**Acknowledged and leveraged**: The metrics measure *what matters* — does the output repair the test?
The comparison demonstrates the trade-offs: a fine-tuned model excels at reproducing known patterns;
a RAG system brings flexibility and zero-shot capability. Both are valid approaches.
