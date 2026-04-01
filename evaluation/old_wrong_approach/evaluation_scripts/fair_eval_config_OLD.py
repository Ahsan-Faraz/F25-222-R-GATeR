"""
Fair Evaluation Configuration
Defines paths, parameters, and stratified sampling strategy for
comparing GATeR (RAG-based) vs TARGET (fine-tuned) on the same TaRBench subset.
"""

import os
from pathlib import Path


def _resolve_path(env_key: str, default_path: str, fallback_paths: list[str]) -> Path:
    """
    Resolve a path from env/default and fall back to first existing candidate.
    """
    raw = os.getenv(env_key, default_path)
    primary = Path(raw)
    if primary.exists():
        return primary

    for candidate in fallback_paths:
        p = Path(candidate)
        if p.exists():
            return p

    return primary

# ── Paths ──────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent

TARBENCH_ROOT = _resolve_path(
    "TARBENCH_ROOT",
    r"d:\Desktop\Target\TaRGET\fine-tuning\TaRBench\TaRBench",
    [
        str(PROJECT_ROOT / "25008893" / "TaRBench" / "TaRBench"),
    ],
)
TARBENCH_PROJECTS_DIR = TARBENCH_ROOT / "projects"
TARBENCH_SPLITS_CSV = TARBENCH_ROOT / "splits.csv"

# TARGET pre-computed results
TARGET_RESULTS_DIR = _resolve_path(
    "TARGET_RESULTS_DIR",
    r"d:\Desktop\Target\TaRGET\fine-tuning\TaRGet_Results\TaRGet_Results\Best_on_TaRBench",
    [
        str(PROJECT_ROOT / "25008893" / "TaRGet_Results" / "TaRGet_Results" / "Best_on_TaRBench"),
        str(PROJECT_ROOT / "25008893" / "TaRGet_Results" / "TaRGet_Results"),
    ],
)
TARGET_PREDICTIONS_FILE = TARGET_RESULTS_DIR / "test_predictions.json"
TARGET_VERDICTS_FILE = TARGET_RESULTS_DIR / "test_verdicts.json"

# GATeR project root
GATER_ROOT = _resolve_path(
    "GATER_ROOT",
    r"c:\Users\Lenovo\Desktop\F25-222-R-GATeR",
    [str(PROJECT_ROOT)],
)

# Output directory for evaluation results
EVAL_OUTPUT_DIR = GATER_ROOT / "evaluation" / "results"

# Per-project repository and store roots used for evaluation preprocessing.
EVAL_REPOS_DIR = Path(os.getenv("EVAL_REPOS_DIR", str(GATER_ROOT / "workspace" / "repos_eval")))
EVAL_STORES_DIR = Path(os.getenv("EVAL_STORES_DIR", str(GATER_ROOT / "workspace" / "eval_stores")))
EVAL_REPO_STORE_MANIFEST = Path(
    os.getenv("EVAL_REPO_STORE_MANIFEST", str(EVAL_STORES_DIR / "repo_store_manifest.json"))
)

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

# ── GATeR LLM Configuration (LM Studio) ──────────────────────────────────────
LM_STUDIO_BASE_URL = os.getenv(
    "LM_STUDIO_BASE_URL",
    os.getenv("OLLAMA_BASE_URL", "http://localhost:1234/v1"),
)
LM_STUDIO_MODEL = os.getenv(
    "LM_STUDIO_MODEL",
    os.getenv("OLLAMA_MODEL", "deepseek/deepseek-r1-0528-qwen3-8b"),
)
LM_STUDIO_API_KEY = os.getenv("LM_STUDIO_API_KEY", "lm-studio")

# Backward-compatible aliases for older imports.
OLLAMA_BASE_URL = LM_STUDIO_BASE_URL
OLLAMA_MODEL = LM_STUDIO_MODEL

# ── TARGET Baseline Stats (from pre-computed results on full test set) ────────
# These are used for reference comparison. For the fair evaluation,
# TARGET's metrics will be recomputed on the SAME subset.
TARGET_FULL_STATS = {
    "test_set_size": 7103,
    "exact_match": 66.08,
    "plausible_rate": 80.04,
    "beam_size": 40,
}
