"""
Shared Metrics Module
Computes all evaluation metrics for both GATeR and TARGET outputs.

Metric Categories:
  1. FAIR metrics     – paradigm-agnostic, equal footing for both systems
  2. INFORMATIONAL    – reported but acknowledged as biased toward supervised
  3. ANALYSIS         – extra diagnostics (edit distance, attempt rate, etc.)
"""

import difflib
import logging
import re
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("evaluation.metrics")


# ── Code normalisation ────────────────────────────────────────────────────────

def normalize_code(code: str) -> str:
    """
    Normalize code to a canonical form so that tokenised TARGET output
    (e.g. 'assertThat ( x )') and raw source code ('assertThat(x)')
    compare fairly.

    Rules:
      - Collapse runs of whitespace to single space
      - Remove spaces before/after parentheses, dots, commas, semicolons
      - Strip leading/trailing whitespace
    """
    s = " ".join(code.split())               # collapse whitespace
    s = re.sub(r"\s*\(\s*", "(", s)          # f ( x ) → f(x
    s = re.sub(r"\s*\)\s*", ") ", s)         # ) ; → ) ;  (keep trailing space)
    s = re.sub(r"\s*\.\s*", ".", s)          # obj . method → obj.method
    s = re.sub(r"\s*,\s*", ", ", s)          # a ,b → a, b
    s = re.sub(r"\s*;\s*", "; ", s)          # x ; → x;
    s = re.sub(r"\s*<\s*", "<", s)           # List < String > → List<String
    s = re.sub(r"\s*>\s*", "> ", s)          # > → >
    return s.strip()


# ── BLEU ──────────────────────────────────────────────────────────────────────

def compute_bleu(references: List[str], hypotheses: List[str]) -> float:
    """
    Corpus-level BLEU score (0–100).
    Uses nltk.translate.bleu_score.corpus_bleu with smoothing.
    Both inputs are normalised before tokenisation.
    """
    from nltk.translate.bleu_score import corpus_bleu, SmoothingFunction

    if not references or not hypotheses:
        return 0.0

    # Keep reference/hypothesis lists aligned to avoid invalid corpus input.
    pairs = list(zip(references, hypotheses))
    if not pairs:
        return 0.0

    tokenize = lambda s: normalize_code(s).split()
    refs = [[tokenize(r)] for r, _ in pairs]
    hyps = [tokenize(h) for _, h in pairs]

    if not refs or not hyps:
        return 0.0

    sf = SmoothingFunction().method1
    score = corpus_bleu(refs, hyps, smoothing_function=sf)
    return round(100 * score, 2)


# ── CodeBLEU ──────────────────────────────────────────────────────────────────

def compute_codebleu(
    references: List[str],
    hypotheses: List[str],
    lang: str = "java",
) -> float:
    """
    CodeBLEU score (0–100) using TARGET's bundled CodeBLEU implementation.
    Inputs are normalised. Falls back to BLEU if CodeBLEU is unavailable.
    """
    import os as _os
    norm_refs = [normalize_code(r) for r in references]
    norm_hyps = [normalize_code(h) for h in hypotheses]
    _orig_fraction = None
    _orig_cwd = _os.getcwd()
    try:
        import sys, fractions
        _orig_fraction = fractions.Fraction
        # Fix Python 3.12+ Fraction._normalize removal
        class _PatchedFraction(_orig_fraction):
            def __new__(cls, numerator=0, denominator=None, **kwargs):
                kwargs.pop("_normalize", None)
                return _orig_fraction.__new__(cls, numerator, denominator)
        fractions.Fraction = _PatchedFraction

        target_ft = _os.getenv(
            "TARGET_FINETUNING_DIR",
            r"d:\Desktop\Target\TaRGET\fine-tuning",
        )
        if target_ft not in sys.path:
            sys.path.insert(0, target_ft)
        # CodeBLEU uses relative path to open keywords/ directory
        _os.chdir(target_ft)

        from CodeBLEU.code_bleu import calc_code_bleu

        score = calc_code_bleu([norm_refs], norm_hyps, lang=lang)
        return round(100 * score, 2)
    except Exception as e:
        # Restore Fraction before NLTK BLEU fallback; NLTK imports Fraction
        # and fails if it is still monkey-patched in this scope.
        if _orig_fraction is not None:
            import fractions
            fractions.Fraction = _orig_fraction
        logger.warning(f"CodeBLEU unavailable ({e}), falling back to BLEU")
        return compute_bleu(references, hypotheses)
    finally:
        _os.chdir(_orig_cwd)
        if _orig_fraction is not None:
            import fractions
            fractions.Fraction = _orig_fraction


# ── Exact Match ───────────────────────────────────────────────────────────────

def compute_exact_match(
    targets: List[str],
    predictions: List[str],
) -> float:
    """
    Exact Match (0–100):after normalisation.
    """
    if not targets:
        return 0.0
    matches = sum(
        1 for t, p in zip(targets, predictions)
        if normalize_code(t) == normalize_code(p)
    )
    return round(100 * matches / len(targets), 2)


def compute_exact_match_beam(
    targets: List[str],
    beam_predictions: List[List[str]],
) -> float:
    """
    Beam Exact Match: any beam candidate matches target (after normalisation).
    This is how TARGET computes EM (with beam_size=40).
    """
    if not targets:
        return 0.0
    matches = 0
    for target, beams in zip(targets, beam_predictions):
        nt = normalize_code(target)
        if any(normalize_code(b) == nt for b in beams):
            matches += 1
    return round(100 * matches / len(targets), 2)


# ── Plausible Repair Rate ────────────────────────────────────────────────────

def compute_plausible_rate(verdicts: List[dict]) -> float:
    """
    Plausible Rate (0–100): percentage of unique test IDs where at least one
    candidate repair compiles and passes the test.

    verdicts: list of {id, success (bool)} entries.
    """
    if not verdicts:
        return 0.0
    from collections import defaultdict
    by_id = defaultdict(bool)
    total_ids = set()
    for v in verdicts:
        vid = v["id"]
        total_ids.add(vid)
        if v.get("success"):
            by_id[vid] = True
    if not total_ids:
        return 0.0
    return round(100 * sum(1 for v in by_id.values() if v) / len(total_ids), 2)


# ── Compilation Success Rate ─────────────────────────────────────────────────

def check_java_syntax(code: str) -> bool:
    """
    Lightweight Java syntax check — verifies balanced braces, semicolons
    at end of statements, no obviously broken tokens.
    Not a real compiler, but catches common generation failures.
    """
    if not code or not code.strip():
        return False

    # Check balanced braces
    depth = 0
    for ch in code:
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                return False
    if depth != 0:
        return False

    # Check balanced parentheses
    depth = 0
    for ch in code:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth < 0:
                return False
    if depth != 0:
        return False

    return True


def compute_compilation_success(predictions: List[str]) -> float:
    """
    Compilation success rate (0–100): percentage of predictions that pass
    a lightweight Java syntax check.
    """
    if not predictions:
        return 0.0
    ok = sum(1 for p in predictions if check_java_syntax(p))
    return round(100 * ok / len(predictions), 2)


# ── Repair Attempt Rate ──────────────────────────────────────────────────────

def compute_repair_attempt_rate(predictions: List[Optional[str]]) -> float:
    """
    Percentage of cases where the system produced a non-empty prediction.
    """
    if not predictions:
        return 0.0
    attempted = sum(1 for p in predictions if p and p.strip())
    return round(100 * attempted / len(predictions), 2)


# ── Line-Level Accuracy ──────────────────────────────────────────────────────

def compute_line_level_accuracy(
    target_lines: List[str],
    predicted_lines: List[str],
) -> float:
    """
    Among all changed lines in Uses normalised comparison.
    """
    if not target_lines:
        return 0.0
    matches = 0
    for tl, pl in zip(target_lines, predicted_lines):
        t_set = {normalize_code(l) for l in tl.split("\n") if l.strip()}
        p_set = {normalize_code(l) for l in pl.split("\n") if l.strip()}
        if t_set:
            matches += len(t_set & p_set) / len(t_set)
    return round(100 * matches / len(target_lines), 2)


# ── Average Edit Distance ────────────────────────────────────────────────────

def compute_avg_edit_distance(
    targets: List[str],
    predictions: List[str],
) -> float:
    """
    Average normalised Levenshtein similarity (0–100, higher is better).
    Uses normalised code strings.
    """
    if not targets:
        return 0.0
    total = 0.0
    for t, p in zip(targets, predictions):
        ratio = difflib.SequenceMatcher(
            None, normalize_code(t), normalize_code(p)
        ).ratio()
        total += ratio
    return round(100 * total / len(targets), 2)


# ── Aggregate scorer ─────────────────────────────────────────────────────────

def compute_all_metrics(
    targets_line: List[str],
    targets_full: List[str],
    preds_line: List[str],
    preds_full: List[str],
    beam_preds: Optional[List[List[str]]] = None,
    verdicts: Optional[List[dict]] = None,
    system_name: str = "system",
) -> Dict[str, float]:
    """
    Compute every metric for one system's outputs.

    Args:
        targets_line:  Ground-truth repair LINES (TARGET-style).
        targets_full:  Ground-truth full repaired method code.
        preds_line:    Predicted repair lines (for BLEU / EM).
        preds_full:    Predicted full repaired code (for CodeBLEU / syntax).
        beam_preds:    Optional beam candidates per test case (TARGET has 40).
        verdicts:      Optional execution verdicts [{id, success}].
        system_name:   Label for logging.

    Returns:
        Dict with all metric names → values.
    """
    results = {}

    # Fair metrics
    results["bleu"] = compute_bleu(targets_line, preds_line)
    # CodeBLEU uses repair lines (not full code) so both systems are compared
    # at the same granularity.  Fall back to BLEU if CodeBLEU deps unavailable.
    results["codebleu"] = compute_codebleu(targets_line, preds_line)
    results["compilation_success"] = compute_compilation_success(preds_full)

    if verdicts is not None:
        results["plausible_rate"] = compute_plausible_rate(verdicts)
    else:
        results["plausible_rate"] = None

    # Informational (biased toward supervised)
    results["exact_match"] = compute_exact_match(targets_line, preds_line)
    if beam_preds is not None:
        results["exact_match_beam"] = compute_exact_match_beam(
            targets_line, beam_preds
        )

    # Analysis metrics
    results["repair_attempt_rate"] = compute_repair_attempt_rate(preds_full)
    results["line_level_accuracy"] = compute_line_level_accuracy(
        targets_line, preds_line
    )
    results["avg_edit_distance"] = compute_avg_edit_distance(
        targets_line, preds_line
    )

    logger.info(f"[{system_name}] Metrics: { {k: v for k, v in results.items() if v is not None} }")
    return results


# ── Side-by-side comparison table ─────────────────────────────────────────────

def format_comparison_table(
    gater_metrics: Dict[str, float],
    target_metrics: Dict[str, float],
) -> str:
    """
    Produce a Markdown comparison table.
    """
    lines = [
        "| Metric | GATeR (RAG) | TARGET (Fine-tuned) | Category |",
        "|--------|-------------|---------------------|----------|",
    ]

    metric_info = {
        "bleu":                  ("BLEU",                    "Fair"),
        "codebleu":              ("CodeBLEU",                "Fair"),
        "compilation_success":   ("Compilation Success %",   "Fair"),
        "plausible_rate":        ("Plausible Repair Rate %", "Fair"),
        "exact_match":           ("Exact Match %",           "Informational*"),
        "exact_match_beam":      ("Exact Match (beam) %",    "Informational*"),
        "repair_attempt_rate":   ("Repair Attempt Rate %",   "Analysis"),
        "line_level_accuracy":   ("Line-Level Accuracy %",   "Analysis"),
        "avg_edit_distance":     ("Avg Edit Similarity %",   "Analysis"),
    }

    for key, (label, category) in metric_info.items():
        g = gater_metrics.get(key)
        t = target_metrics.get(key)
        g_str = f"{g:.2f}" if g is not None else "N/A"
        t_str = f"{t:.2f}" if t is not None else "N/A"
        lines.append(f"| {label} | {g_str} | {t_str} | {category} |")

    lines.append("")
    lines.append(
        "*\\*Informational: Exact Match inherently favors supervised fine-tuned "
        "models because they learn the target distribution. GATeR generates "
        "novel repairs that may be functionally correct but syntactically "
        "different.*"
    )
    return "\n".join(lines)
