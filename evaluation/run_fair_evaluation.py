"""
run_fair_evaluation.py
Main entry point for the fair side-by-side evaluation of GATeR vs TARGET.

Usage:
    python -m evaluation.run_fair_evaluation [--sample-size 500] [--seed 42]
                                              [--skip-gater-run]
                                              [--output-dir evaluation/results]
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

try:
    import matplotlib
    matplotlib.use("Agg")  # non-interactive backend for servers
    import matplotlib.pyplot as plt
    import matplotlib.ticker as mtick
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

# Ensure project root is on the path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from evaluation.fair_eval_config import (
    EVAL_OUTPUT_DIR,
    GATER_ROOT,
    RANDOM_SEED,
    SAMPLE_SIZE,
    TARGET_FULL_STATS,
)
from evaluation.metrics import (
    compute_all_metrics,
    format_comparison_table,
)
from evaluation.tarbench_bridge import (
    build_evaluation_dataset,
    extract_ground_truth,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("evaluation.runner")


# ── GATeR repair runner ───────────────────────────────────────────────────────

def run_gater_on_record(record: dict) -> Dict:
    """
    Run GATeR's repair pipeline on one evaluation record.

    Returns dict with:
      - repaired_lines: extracted changed lines (for BLEU/EM)
      - repaired_full_code: full repaired code (for CodeBLEU)
      - success: bool
      - time_s: float
    """
    from src.gatr.gatr_engine import GATREngine

    gater_input = record["gater_input"]
    broken_test = gater_input["broken_test"]
    error_message = gater_input["error_message"]
    project = record["project"]

    try:
        engine = GATREngine()
        start = time.time()
        result = engine.repair_test(
            broken_test=broken_test,
            error_message=error_message,
            project_name=project,
        )
        elapsed = time.time() - start

        repaired_code = result.repaired_code if result.success else ""

        # Extract the repair lines by diffing against broken code
        repaired_lines = _extract_changed_lines(
            broken_test.get("test_code", ""),
            repaired_code,
        )

        return {
            "repaired_lines": repaired_lines,
            "repaired_full_code": repaired_code,
            "success": result.success,
            "strategy": result.repair_strategy,
            "time_s": elapsed,
        }
    except Exception as e:
        logger.warning(f"GATeR failed on {record['id']}: {e}")
        return {
            "repaired_lines": "",
            "repaired_full_code": "",
            "success": False,
            "strategy": "error",
            "time_s": 0.0,
        }


def _extract_changed_lines(original: str, repaired: str) -> str:
    """
    Given original and repaired code, extract only the lines that changed.
    This mirrors TARGET's output format (just the repair lines).
    """
    if not original or not repaired:
        return repaired

    orig_lines = original.splitlines()
    rep_lines = repaired.splitlines()

    differ = list(
        __import__("difflib").unified_diff(orig_lines, rep_lines, lineterm="")
    )

    # Collect added lines (lines starting with '+' but not '+++')
    added = []
    for line in differ:
        if line.startswith("+") and not line.startswith("+++"):
            added.append(line[1:])  # strip the leading '+'

    return "\n".join(added) if added else repaired


# ── Extract TARGET's metrics for the subset ───────────────────────────────────

def collect_target_outputs(records: List[dict]) -> Dict:
    """
    Collect TARGET's predictions and verdicts for the sampled subset.
    Returns lists aligned with `records`.
    """
    targets_line = []
    preds_line = []
    targets_full = []
    preds_full = []
    beam_preds_list = []
    verdicts = []

    for rec in records:
        gt = rec["ground_truth"]
        tp = rec.get("target_pred")

        targets_line.append(gt["repaired_lines"])
        targets_full.append(gt["repaired_full_code"])

        if tp:
            best = tp["best_pred"]
            preds_line.append(best)
            # TARGET outputs repair LINES, not full code,
            # so for CodeBLEU we use the lines as well
            preds_full.append(best)
            beam_preds_list.append(tp["preds"])
            verdicts.append({
                "id": rec["id"],
                "success": tp["plausible"],
            })
        else:
            preds_line.append("")
            preds_full.append("")
            beam_preds_list.append([])
            verdicts.append({"id": rec["id"], "success": False})

    return {
        "targets_line": targets_line,
        "targets_full": targets_full,
        "preds_line": preds_line,
        "preds_full": preds_full,
        "beam_preds": beam_preds_list,
        "verdicts": verdicts,
    }


# ── Main evaluation loop ─────────────────────────────────────────────────────

def run_evaluation(
    sample_size: int = SAMPLE_SIZE,
    seed: int = RANDOM_SEED,
    skip_gater: bool = False,
    output_dir: Optional[Path] = None,
):
    """
    Full evaluation pipeline:
      1. Build stratified TaRBench sample
      2. (optionally) Run GATeR on each case
      3. Collect TARGET predictions for the same cases
      4. Compute all metrics for both systems
      5. Produce comparison table and save results
    """
    output_dir = Path(output_dir) if output_dir else EVAL_OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # ── Step 1: Build evaluation dataset ─────────────────────────────────
    logger.info("Step 1 / 5: Building stratified evaluation dataset ...")
    records = build_evaluation_dataset(sample_size=sample_size, seed=seed)

    # Save the sampled IDs for reproducibility
    sample_ids = [r["id"] for r in records]
    (output_dir / f"sample_ids_{timestamp}.json").write_text(
        json.dumps(sample_ids, indent=2)
    )
    logger.info(f"Saved {len(sample_ids)} sample IDs")

    # ── Step 2: Run GATeR ────────────────────────────────────────────────
    gater_results = {}
    if not skip_gater:
        logger.info("Step 2 / 5: Running GATeR on sampled test cases ...")
        for i, rec in enumerate(records):
            logger.info(f"  [{i+1}/{len(records)}] {rec['id']} ({rec['project']})")
            gater_results[rec["id"]] = run_gater_on_record(rec)
    else:
        logger.info("Step 2 / 5: Skipped GATeR run (--skip-gater-run)")
        # Try to load previous GATeR results
        prev = sorted(output_dir.glob("gater_predictions_*.json"), reverse=True)
        if prev:
            logger.info(f"Loading previous GATeR results from {prev[0]}")
            gater_results = json.loads(prev[0].read_text())

    # Save GATeR predictions
    if gater_results:
        (output_dir / f"gater_predictions_{timestamp}.json").write_text(
            json.dumps(gater_results, indent=2, default=str)
        )

    # ── Step 3: Collect TARGET outputs ───────────────────────────────────
    logger.info("Step 3 / 5: Collecting TARGET predictions for the subset ...")
    target_data = collect_target_outputs(records)

    # ── Step 4: Compute metrics ──────────────────────────────────────────
    logger.info("Step 4 / 5: Computing metrics ...")

    # TARGET metrics on the subset
    target_metrics = compute_all_metrics(
        targets_line=target_data["targets_line"],
        targets_full=target_data["targets_full"],
        preds_line=target_data["preds_line"],
        preds_full=target_data["preds_full"],
        beam_preds=target_data["beam_preds"],
        verdicts=target_data["verdicts"],
        system_name="TARGET",
    )

    # GATeR metrics on the subset (if we ran it)
    if gater_results:
        gater_targets_line = []
        gater_preds_line = []
        gater_targets_full = []
        gater_preds_full = []

        for rec in records:
            gt = rec["ground_truth"]
            gr = gater_results.get(rec["id"], {})

            gater_targets_line.append(gt["repaired_lines"])
            gater_targets_full.append(gt["repaired_full_code"])
            gater_preds_line.append(gr.get("repaired_lines", ""))
            gater_preds_full.append(gr.get("repaired_full_code", ""))

        # GATeR does NOT have execution verdicts (would need to compile +
        # run each repair in the project's build).  Pass verdicts=None so
        # plausible_rate is reported as N/A rather than misleadingly using
        # the pipeline-success flag.
        gater_metrics = compute_all_metrics(
            targets_line=gater_targets_line,
            targets_full=gater_targets_full,
            preds_line=gater_preds_line,
            preds_full=gater_preds_full,
            verdicts=None,
            system_name="GATeR",
        )
    else:
        gater_metrics = {k: None for k in target_metrics}

    # ── Step 5: Generate comparison and save ─────────────────────────────
    logger.info("Step 5 / 5: Generating comparison report ...")

    comparison_table = format_comparison_table(gater_metrics, target_metrics)

    report = _generate_report(
        records, gater_metrics, target_metrics, comparison_table,
        sample_size, seed, timestamp,
    )

    report_path = output_dir / f"fair_evaluation_report_{timestamp}.md"
    report_path.write_text(report, encoding="utf-8")

    results_path = output_dir / f"fair_evaluation_results_{timestamp}.json"
    results_path.write_text(json.dumps({
        "timestamp": timestamp,
        "sample_size": len(records),
        "seed": seed,
        "projects": list({r["project"] for r in records}),
        "gater_metrics": gater_metrics,
        "target_metrics": target_metrics,
        "target_full_stats": TARGET_FULL_STATS,
    }, indent=2, default=str))

    # ── Step 6: Generate comparison graphs ────────────────────────────
    logger.info("Step 6: Generating comparison graphs ...")
    graphs_dir = output_dir / "graphs"
    graphs_dir.mkdir(parents=True, exist_ok=True)
    graph_paths = generate_comparison_graphs(
        gater_metrics, target_metrics, graphs_dir, timestamp,
    )
    if graph_paths:
        logger.info(f"Saved {len(graph_paths)} graphs to {graphs_dir}")

    print("\n" + "=" * 70)
    print(" FAIR EVALUATION RESULTS")
    print("=" * 70)
    print(comparison_table)
    print(f"\nFull report saved to: {report_path}")
    print(f"Raw results saved to: {results_path}")
    if graph_paths:
        print(f"Graphs saved to: {graphs_dir}")

    return gater_metrics, target_metrics


# ── Graph generation ──────────────────────────────────────────────────────────

# Colour palette — colour-blind friendly
_CLR_GATER = "#2196F3"   # blue
_CLR_TARGET = "#FF9800"  # orange


def generate_comparison_graphs(
    gater_metrics: Dict[str, float],
    target_metrics: Dict[str, float],
    output_dir: Path,
    timestamp: str,
) -> List[Path]:
    """Generate all comparison graphs.  Returns list of saved file paths."""
    if not HAS_MATPLOTLIB:
        logger.warning("matplotlib not installed — skipping graph generation")
        return []

    paths: List[Path] = []
    paths.append(_graph_fair_metrics(gater_metrics, target_metrics, output_dir, timestamp))
    paths.append(_graph_all_metrics_radar(gater_metrics, target_metrics, output_dir, timestamp))
    paths.append(_graph_analysis_metrics(gater_metrics, target_metrics, output_dir, timestamp))
    paths.append(_graph_paradigm_tradeoff(gater_metrics, target_metrics, output_dir, timestamp))
    return [p for p in paths if p is not None]


def _graph_fair_metrics(
    gm: Dict, tm: Dict, out: Path, ts: str,
) -> Optional[Path]:
    """Bar chart: primary fair comparison metrics (BLEU, CodeBLEU, Compilation, Edit Sim)."""
    labels = ["BLEU", "CodeBLEU", "Compilation %", "Edit Similarity %"]
    keys = ["bleu", "codebleu", "compilation_success", "avg_edit_distance"]
    g_vals = [gm.get(k, 0) or 0 for k in keys]
    t_vals = [tm.get(k, 0) or 0 for k in keys]

    fig, ax = plt.subplots(figsize=(10, 6))
    x = range(len(labels))
    w = 0.35
    bars_g = ax.bar([i - w / 2 for i in x], g_vals, w, label="GATeR (Zero-Shot RAG)",
                    color=_CLR_GATER, edgecolor="white", linewidth=0.8)
    bars_t = ax.bar([i + w / 2 for i in x], t_vals, w, label="TARGET (Fine-Tuned)",
                    color=_CLR_TARGET, edgecolor="white", linewidth=0.8)

    # Value labels on bars
    for bar in bars_g:
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.8,
                f"{bar.get_height():.1f}", ha="center", va="bottom", fontsize=9, fontweight="bold")
    for bar in bars_t:
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.8,
                f"{bar.get_height():.1f}", ha="center", va="bottom", fontsize=9, fontweight="bold")

    ax.set_ylabel("Score (0–100)", fontsize=12)
    ax.set_title("GATeR vs TARGET — Fair Comparison Metrics", fontsize=14, fontweight="bold")
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=11)
    ax.set_ylim(0, 105)
    ax.legend(fontsize=11)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    p = out / f"fair_metrics_{ts}.png"
    fig.savefig(p, dpi=200)
    plt.close(fig)
    return p


def _graph_analysis_metrics(
    gm: Dict, tm: Dict, out: Path, ts: str,
) -> Optional[Path]:
    """Horizontal bar chart: analysis / diagnostic metrics."""
    labels = ["Repair Attempt Rate", "Line-Level Accuracy", "Edit Similarity",
              "Exact Match", "Compilation Success"]
    keys = ["repair_attempt_rate", "line_level_accuracy", "avg_edit_distance",
            "exact_match", "compilation_success"]
    g_vals = [gm.get(k, 0) or 0 for k in keys]
    t_vals = [tm.get(k, 0) or 0 for k in keys]

    fig, ax = plt.subplots(figsize=(10, 6))
    y = range(len(labels))
    h = 0.35
    ax.barh([i + h / 2 for i in y], t_vals, h, label="TARGET (Fine-Tuned)",
            color=_CLR_TARGET, edgecolor="white", linewidth=0.8)
    ax.barh([i - h / 2 for i in y], g_vals, h, label="GATeR (Zero-Shot RAG)",
            color=_CLR_GATER, edgecolor="white", linewidth=0.8)

    for i, (gv, tv) in enumerate(zip(g_vals, t_vals)):
        ax.text(gv + 0.8, i - h / 2, f"{gv:.1f}", va="center", fontsize=9)
        ax.text(tv + 0.8, i + h / 2, f"{tv:.1f}", va="center", fontsize=9)

    ax.set_xlabel("Score (0–100)", fontsize=12)
    ax.set_title("GATeR vs TARGET — All Metrics Overview", fontsize=14, fontweight="bold")
    ax.set_yticks(list(y))
    ax.set_yticklabels(labels, fontsize=11)
    ax.set_xlim(0, 110)
    ax.legend(loc="lower right", fontsize=11)
    ax.grid(axis="x", alpha=0.3)
    fig.tight_layout()
    p = out / f"all_metrics_{ts}.png"
    fig.savefig(p, dpi=200)
    plt.close(fig)
    return p


def _graph_all_metrics_radar(
    gm: Dict, tm: Dict, out: Path, ts: str,
) -> Optional[Path]:
    """Radar / spider chart showing both systems across all comparable metrics."""
    import numpy as np

    labels = ["BLEU", "CodeBLEU", "Compilation", "Edit Sim",
              "Line Acc", "Exact Match", "Attempt Rate"]
    keys = ["bleu", "codebleu", "compilation_success", "avg_edit_distance",
            "line_level_accuracy", "exact_match", "repair_attempt_rate"]
    g_vals = [gm.get(k, 0) or 0 for k in keys]
    t_vals = [tm.get(k, 0) or 0 for k in keys]

    n = len(labels)
    angles = [i / n * 2 * np.pi for i in range(n)]
    # Close the polygon
    g_vals_c = g_vals + [g_vals[0]]
    t_vals_c = t_vals + [t_vals[0]]
    angles_c = angles + [angles[0]]

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw={"projection": "polar"})
    ax.plot(angles_c, g_vals_c, "o-", linewidth=2, label="GATeR", color=_CLR_GATER)
    ax.fill(angles_c, g_vals_c, alpha=0.15, color=_CLR_GATER)
    ax.plot(angles_c, t_vals_c, "s-", linewidth=2, label="TARGET", color=_CLR_TARGET)
    ax.fill(angles_c, t_vals_c, alpha=0.15, color=_CLR_TARGET)

    ax.set_xticks(angles)
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_ylim(0, 100)
    ax.set_title("GATeR vs TARGET — Radar Comparison", fontsize=14,
                 fontweight="bold", pad=20)
    ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.1), fontsize=11)
    fig.tight_layout()
    p = out / f"radar_comparison_{ts}.png"
    fig.savefig(p, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return p


def _graph_paradigm_tradeoff(
    gm: Dict, tm: Dict, out: Path, ts: str,
) -> Optional[Path]:
    """Grouped chart contrasting fair vs biased metrics to highlight paradigm trade-off."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 6),
                                    gridspec_kw={"width_ratios": [3, 2]})

    # Left panel: Fair metrics
    fair_labels = ["BLEU", "CodeBLEU", "Compilation %", "Edit Similarity"]
    fair_keys = ["bleu", "codebleu", "compilation_success", "avg_edit_distance"]
    fg = [gm.get(k, 0) or 0 for k in fair_keys]
    ft = [tm.get(k, 0) or 0 for k in fair_keys]

    x = range(len(fair_labels))
    w = 0.35
    ax1.bar([i - w / 2 for i in x], fg, w, label="GATeR", color=_CLR_GATER)
    ax1.bar([i + w / 2 for i in x], ft, w, label="TARGET", color=_CLR_TARGET)
    ax1.set_xticks(list(x))
    ax1.set_xticklabels(fair_labels, fontsize=10)
    ax1.set_ylim(0, 105)
    ax1.set_ylabel("Score (0–100)")
    ax1.set_title("Fair Metrics (paradigm-neutral)", fontsize=12, fontweight="bold")
    ax1.legend(fontsize=10)
    ax1.grid(axis="y", alpha=0.3)

    # Right panel: Biased metric
    bias_labels = ["Exact Match"]
    bias_keys = ["exact_match"]
    bg = [gm.get(k, 0) or 0 for k in bias_keys]
    bt = [tm.get(k, 0) or 0 for k in bias_keys]

    bx = range(len(bias_labels))
    ax2.bar([i - w / 2 for i in bx], bg, w, label="GATeR", color=_CLR_GATER, hatch="//", alpha=0.7)
    ax2.bar([i + w / 2 for i in bx], bt, w, label="TARGET", color=_CLR_TARGET, hatch="//", alpha=0.7)
    ax2.set_xticks(list(bx))
    ax2.set_xticklabels(bias_labels, fontsize=10)
    ax2.set_ylim(0, 105)
    ax2.set_title("Biased Metric\n(favours supervised)", fontsize=12, fontweight="bold")
    ax2.legend(fontsize=10)
    ax2.grid(axis="y", alpha=0.3)
    ax2.annotate("Inherently favours\nfine-tuned models",
                 xy=(0, max(bt) + 2), fontsize=9, ha="center",
                 color="red", fontstyle="italic")

    fig.suptitle("Paradigm Trade-off: Fair vs Biased Metrics",
                 fontsize=14, fontweight="bold", y=1.02)
    fig.tight_layout()
    p = out / f"paradigm_tradeoff_{ts}.png"
    fig.savefig(p, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return p


# ── Report generation ─────────────────────────────────────────────────────────

def _generate_report(
    records, gater_metrics, target_metrics, table,
    sample_size, seed, timestamp,
) -> str:
    projects = sorted({r["project"] for r in records})
    verdict_dist = {}
    for r in records:
        vt = r["verdict_type"]
        verdict_dist[vt] = verdict_dist.get(vt, 0) + 1

    return f"""# Fair Evaluation Report: GATeR vs TARGET
**Generated**: {timestamp}

## 1. Evaluation Protocol

### Why This Evaluation Is Fair
| Concern | Resolution |
|---------|------------|
| **Dataset size mismatch** (TARGET: 7,103 vs GATeR: 300 custom) | Both systems evaluated on the **same** stratified sample of **{sample_size}** TaRBench test cases |
| **Exact Match bias** | EM is reported as *informational only*; primary comparison uses paradigm-agnostic BLEU, CodeBLEU, and Plausible Rate |
| **Paradigm difference** (supervised vs RAG) | Metrics chosen measure *output quality*, not training methodology |

### Sampling Details
- **Source**: TaRBench test split (7,103 cases, 59 projects)
- **Sample size**: {sample_size}
- **Random seed**: {seed} (reproducible)
- **Stratification**: verdict type × trivial flag × project diversity
- **Verdict distribution in sample**: {json.dumps(verdict_dist)}
- **Projects represented**: {len(projects)} — {', '.join(projects[:10])}{'...' if len(projects) > 10 else ''}

## 2. Results

{table}

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
- Exact Match: {TARGET_FULL_STATS['exact_match']}%
- Plausible Rate: {TARGET_FULL_STATS['plausible_rate']}%
- Beam size: {TARGET_FULL_STATS['beam_size']}

## 6. Reproduction

```bash
# Run with default 500-case sample:
python -m evaluation.run_fair_evaluation

# Custom sample size:
python -m evaluation.run_fair_evaluation --sample-size 1000 --seed 42

# Skip GATeR run (only compute TARGET metrics on the subset):
python -m evaluation.run_fair_evaluation --skip-gater-run
```
"""


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Fair side-by-side evaluation of GATeR vs TARGET on TaRBench"
    )
    parser.add_argument(
        "--sample-size", type=int, default=SAMPLE_SIZE,
        help=f"Number of test cases to sample (default: {SAMPLE_SIZE})",
    )
    parser.add_argument(
        "--seed", type=int, default=RANDOM_SEED,
        help=f"Random seed for reproducibility (default: {RANDOM_SEED})",
    )
    parser.add_argument(
        "--skip-gater-run", action="store_true",
        help="Skip running GATeR; only compute TARGET metrics on the subset",
    )
    parser.add_argument(
        "--output-dir", type=str, default=str(EVAL_OUTPUT_DIR),
        help=f"Directory for results (default: {EVAL_OUTPUT_DIR})",
    )
    args = parser.parse_args()

    run_evaluation(
        sample_size=args.sample_size,
        seed=args.seed,
        skip_gater=args.skip_gater_run,
        output_dir=Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
