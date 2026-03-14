"""
Fair Evaluation Configuration
Defines paths, parameters, and stratified sampling strategy for
comparing GATeR (RAG-based) vs TARGET (fine-tuned) on the same TaRBench subset.
"""

import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
TARBENCH_ROOT = Path(os.getenv(
    "TARBENCH_ROOT",
    r"d:\Desktop\Target\TaRGET\fine-tuning\TaRBench\TaRBench"
))
TARBENCH_PROJECTS_DIR = TARBENCH_ROOT / "projects"
TARBENCH_SPLITS_CSV = TARBENCH_ROOT / "splits.csv"

# TARGET pre-computed results
TARGET_RESULTS_DIR = Path(os.getenv(
    "TARGET_RESULTS_DIR",
    r"d:\Desktop\Target\TaRGET\fine-tuning\TaRGet_Results\TaRGet_Results\Best_on_TaRBench"
))
TARGET_PREDICTIONS_FILE = TARGET_RESULTS_DIR / "test_predictions.json"
TARGET_VERDICTS_FILE = TARGET_RESULTS_DIR / "test_verdicts.json"

# GATeR project root
GATER_ROOT = Path(os.getenv(
    "GATER_ROOT",
    r"c:\Users\Lenovo\Desktop\F25-222-R-GATeR"
))

# Output directory for evaluation results
EVAL_OUTPUT_DIR = GATER_ROOT / "evaluation" / "results"

# ── Sampling Parameters ────────────────────────────────────────────────────────
# Stratified sampling from TaRBench test split for fair side-by-side comparison.
# Using 500 cases provides statistical significance while being practical for
# GATeR's KG-building overhead per project.
SAMPLE_SIZE = 500

# Stratification criteria
STRATIFY_BY_VERDICT = True           # Balance compile_error vs failure
STRATIFY_BY_TRIVIAL = True           # Balance trivial vs non-trivial repairs
MIN_PROJECTS_IN_SAMPLE = 10          # Ensure project diversity
MAX_CASES_PER_PROJECT = 80           # Prevent one project from dominating
RANDOM_SEED = 42                     # Reproducibility

# ── Metric Configuration ──────────────────────────────────────────────────────
# Metrics that are FAIR to both paradigms (main comparison metrics)
FAIR_METRICS = [
    "bleu",                # Text similarity — paradigm-agnostic
    "codebleu",            # Code-aware similarity — paradigm-agnostic
    "compilation_success", # Does repaired code compile? — paradigm-agnostic
    "plausible_rate",      # Does repaired test pass? — THE fairest metric
]

# Metrics that are INFORMATIONAL but biased toward supervised models
INFORMATIONAL_METRICS = [
    "exact_match",         # Biased: fine-tuned models learn target distribution
]

# Additional analysis metrics
ANALYSIS_METRICS = [
    "repair_attempt_rate", # % of cases where system produces output
    "line_level_accuracy", # % of changed lines that match ground truth
    "avg_edit_distance",   # Levenshtein distance to ground truth
]

# ── GATeR Configuration ───────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-coder:6.7b")

# ── TARGET Baseline Stats (from pre-computed results on full test set) ────────
# These are used for reference comparison. For the fair evaluation,
# TARGET's metrics will be recomputed on the SAME subset.
TARGET_FULL_STATS = {
    "test_set_size": 7103,
    "exact_match": 66.08,
    "plausible_rate": 80.04,
    "beam_size": 40,
}
