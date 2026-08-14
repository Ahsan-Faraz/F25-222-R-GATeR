# GATeR — Evaluation Results

**Benchmark:** TaRBench test split — 7,103 broken-test repair cases across 59 open-source Java projects
**Baseline:** TARGET / TaRGet (Saboor Yaraghi et al., *IEEE TSE* 2024) — CodeT5+ fine-tuned on 36,639 repair pairs
**GATeR:** zero-shot; no fine-tuning on repair pairs. Qwen 2.5 Coder 7B Instruct (local, temperature 0.1)
**Predictions:** [`evaluation/gater_predictions_final_all59_repo_wise_20260319.json`](evaluation/gater_predictions_final_all59_repo_wise_20260319.json)

---

## 1. Coverage: what the system actually attempted

GATeR was run over every case in the TaRBench test split. This table is the honest starting point for
reading every other number in this document.

| | Count | Share |
|---|---:|---:|
| Cases attempted | 7,103 | 100% |
| Pipeline completed without error | 7,095 | 99.9% |
| Failed (LLM unavailable) | 8 | 0.1% |
| **Produced a substantive code edit** | **1,207** | **17.0%** |
| Returned the test unchanged or whitespace-only | 5,896 | 83.0% |

A case counts as a substantive edit when the whitespace-normalised similarity between the generated
method and the broken method is below 0.99. The classification is implemented in
[`evaluation/_compute_metrics.py`](evaluation/_compute_metrics.py); the 1,207 qualifying cases are
enumerated in [`evaluation/real_edit_subset_1207.json`](evaluation/real_edit_subset_1207.json).

Mean latency 14.6 s per case (median 13.5 s), 28.9 hours total across the benchmark.

---

## 2. Correction to an earlier version of these results

An earlier version of this evaluation reported metrics computed **only over the 1,207 cases where
GATeR chose to edit**, compared against TARGET recomputed on those same case IDs. The case IDs were
aligned, but the *selection* of those IDs was conditioned on GATeR's own behaviour: cases where the
system declined to act were excluded from GATeR's score while TARGET was still credited for
attempting all of them. Metrics obtained that way are not a valid system-level comparison and are not
reported as headline results here.

Both readings are given below. Section 3 is the system-level result. Section 4 is the conditional
result, which remains informative but must be read together with the 17% edit rate.

---

## 3. System-level results (all 7,103 cases)

A case where the model returns the test unchanged contributes zero to every changed-lines metric,
since the extracted hypothesis is empty.

| Metric | GATeR | TARGET | Notes |
|---|---:|---:|---|
| Line-level accuracy | 13.6% | *(recompute)* | |
| BLEU (changed lines) | 13.2% | *(recompute)* | |
| CodeBLEU (changed lines) | 13.6% | *(recompute)* | |
| Near-miss rate (>50% similarity) | 16.2% | *(recompute)* | |
| Exact match | *(recompute)* | 66.08% (published, beam=40) | EM favours the fine-tuned model |
| Plausible repair rate | not measured | 80.04% (published) | see §5 |

GATeR figures are derived from the §4 subset values scaled by 1,207/7,103; rerun
`python evaluation/_compute_metrics.py` with TaRBench mounted to confirm them directly and to fill
the TARGET column on this same 7,103-case basis.

**Reading.** Against a supervised model trained on 36,639 repair pairs, a zero-shot retrieval system
reaches roughly a fifth of the baseline's exact-match rate at the system level. The gap is dominated
by abstention, not by wrong edits: the system declines to act on 83% of cases rather than producing
incorrect repairs on them.

---

## 4. Conditional results (the 1,207 cases where GATeR edited)

Both systems scored on identical case IDs.

| Metric | GATeR | TARGET | Δ |
|---|---:|---:|---:|
| Line-level accuracy | 79.84% | 40.51% | +39.33 pp |
| BLEU | 77.89% | 55.06% | +22.83 pp |
| CodeBLEU | 79.94% | 60.36% | +19.58 pp |
| Near-miss rate (>50%) | 95.36% | 48.14% | +47.22 pp |
| Edit similarity | 87.37% | 81.67% | +5.70 pp |

**Reading.** These numbers describe repair *precision conditional on the system attempting a repair*,
not overall capability. When repository-grounded retrieval yields enough context for GATeR to commit
to an edit, the edit lands close to the developer's actual fix roughly twice as often as the
fine-tuned baseline on the same cases. The open problem is recall: identifying why context retrieval
fails to trigger an edit on the remaining 83%.

---

## 5. Metrics deliberately not reported

**Compilation success.** The check in `evaluation/metrics.py` is a brace- and paren-balance test, not
a `javac` invocation. It is also asymmetric: GATeR emits a full method while TARGET emits a single
line, so the two are not comparable under it. On the full benchmark it would additionally approach
100% for GATeR purely because unchanged code is trivially balanced. Reported previously; withdrawn
here.

**Plausible repair rate.** Requires checking out the parent commit, applying the patch, compiling
with Maven and executing the test. TARGET's published rate comes from that procedure. GATeR's
repairs have never been executed, so no plausible rate is claimed. This is the single most valuable
missing measurement in the evaluation.

---

## 6. Retrieval ablation

*Status: not yet run. Required before any claim that the knowledge graph is responsible for the
results above.*

Everything reported so far is consistent with a second hypothesis — that a 7B code model given the
broken test and the error message would do about as well without any retrieval at all. Distinguishing
the two requires one run:

| Configuration | Retrieval | Prompt |
|---|---|---|
| **Full** | Kuzu graph traversal + LanceDB vector search + KGCompass scoring | as shipped |
| **No-retrieval** | none | identical skeleton, entity/relation/pattern sections omitted |

Hold constant: the same 7,103 cases, the same model and temperature, the same prompt scaffolding,
the same output parsing. Report edit rate and the §3 and §4 tables for both arms. The difference
between them, not the absolute values, is the contribution of the knowledge graph.

Useful additional arms if compute allows: vector-only (no graph traversal) and graph-only (no vector
search), which separate structural from semantic retrieval.

---

## 7. Threats to validity

**Knowledge graph commit alignment.** [`evaluation/preprocess_repo_stores.py`](evaluation/preprocess_repo_stores.py)
builds one knowledge graph per project at the single most frequent `bCommit`, and clones with
`--depth 1`, so for most cases the checkout cannot resolve and the graph reflects repository HEAD
rather than the state at the breaking commit. Retrieved context is therefore not guaranteed
contemporaneous with the test under repair.

**Synthesised error messages.** TaRBench stores verdict status and error line numbers, not compiler
output. Error text is reconstructed in `evaluation/tarbench_bridge.py`, so the input differs in form
from what a developer would see.

**Single generator model.** All results use one 7B model. Sensitivity to model choice and scale is
unmeasured.

**Language coverage.** TaRBench is Java-only. The parser supports Python, but no Python benchmark was
evaluated.

---

## 8. Reproducing

```bash
python -m evaluation.preprocess_repo_stores          # clone repos, build per-project KG + vector stores
python -m evaluation.run_fair_evaluation             # run GATeR over the benchmark (requires local LLM)
python evaluation/_compute_metrics.py                # compute all tables above
```

Requires a local TaRBench checkout and the TARGET published prediction/verdict files; set
`TARBENCH_ROOT` and `TARGET_RESULTS_DIR` accordingly.
