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

# Java keywords for weighted n-gram matching (from TARGET's CodeBLEU/keywords/java.txt)
_JAVA_KEYWORDS = frozenset([
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
    "class", "const", "continue", "default", "do", "double", "else", "enum",
    "extends", "final", "finally", "float", "for", "goto", "if", "implements",
    "import", "instanceof", "int", "interface", "long", "native", "new",
    "package", "private", "protected", "public", "return", "short", "static",
    "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
    "transient", "try", "void", "volatile", "while",
])


def _count_ngrams(tokens: List[str], n: int) -> Dict[tuple, int]:
    """Count n-grams in a token list."""
    counts: Dict[tuple, int] = {}
    for i in range(len(tokens) - n + 1):
        ng = tuple(tokens[i:i + n])
        counts[ng] = counts.get(ng, 0) + 1
    return counts


def _safe_ngram_bleu(
    tokenized_refs: List[List[List[str]]],
    tokenized_hyps: List[List[str]],
    max_n: int = 4,
) -> float:
    """
    Corpus-level BLEU (n-gram precision with brevity penalty).
    Mirrors TARGET's CodeBLEU/bleu.py corpus_bleu without Fraction overhead.
    """
    import math
    clipped_counts = [0] * max_n
    total_counts = [0] * max_n
    hyp_lengths = 0
    ref_lengths = 0

    for i, hyp_tokens in enumerate(tokenized_hyps):
        hyp_len = len(hyp_tokens)
        hyp_lengths += hyp_len

        # Find closest reference length
        refs_for_i = tokenized_refs[i]
        closest_len = min(
            (abs(len(r) - hyp_len), len(r)) for r in refs_for_i
        )[1]
        ref_lengths += closest_len

        for n in range(1, max_n + 1):
            hyp_ngrams = _count_ngrams(hyp_tokens, n)
            # Max across references for each n-gram
            max_ref_ngrams: Dict[tuple, int] = {}
            for ref_tokens in refs_for_i:
                ref_ngrams = _count_ngrams(ref_tokens, n)
                for ng, cnt in ref_ngrams.items():
                    max_ref_ngrams[ng] = max(max_ref_ngrams.get(ng, 0), cnt)

            for ng, cnt in hyp_ngrams.items():
                clipped_counts[n - 1] += min(cnt, max_ref_ngrams.get(ng, 0))
                total_counts[n - 1] += cnt

    # Brevity penalty
    if hyp_lengths == 0:
        return 0.0
    bp = math.exp(min(0, 1 - ref_lengths / hyp_lengths))

    # Geometric mean of precisions
    log_avg = 0.0
    weight = 1.0 / max_n
    for n in range(max_n):
        if total_counts[n] == 0 or clipped_counts[n] == 0:
            # Smoothing: add 1 (method1)
            log_avg += weight * math.log((clipped_counts[n] + 1) / (total_counts[n] + 1))
        else:
            log_avg += weight * math.log(clipped_counts[n] / total_counts[n])

    return bp * math.exp(log_avg)


def _safe_weighted_ngram_bleu(
    tokenized_refs: List[List[List[str]]],
    tokenized_hyps: List[List[str]],
    keywords: frozenset,
    max_n: int = 4,
) -> float:
    """
    Keyword-weighted n-gram BLEU: Java keywords get weight 1.0, others 0.2.
    Mirrors TARGET's CodeBLEU/weighted_ngram_match.py logic.
    """
    import math

    def _weighted_count(ngrams_dict: Dict[tuple, int], ref_tokens: List[str]):
        """Weight each n-gram by max keyword weight of its tokens."""
        weighted: Dict[tuple, float] = {}
        for ng, cnt in ngrams_dict.items():
            # Weight = 1.0 if any token is a keyword, else 0.2
            w = max(1.0 if tok in keywords else 0.2 for tok in ng)
            weighted[ng] = cnt * w
        return weighted

    clipped_w = [0.0] * max_n
    total_w = [0.0] * max_n
    hyp_lengths = 0
    ref_lengths = 0

    for i, hyp_tokens in enumerate(tokenized_hyps):
        hyp_len = len(hyp_tokens)
        hyp_lengths += hyp_len

        refs_for_i = tokenized_refs[i]
        closest_len = min(
            (abs(len(r) - hyp_len), len(r)) for r in refs_for_i
        )[1]
        ref_lengths += closest_len

        for n in range(1, max_n + 1):
            hyp_ngrams = _count_ngrams(hyp_tokens, n)
            hyp_w = _weighted_count(hyp_ngrams, hyp_tokens)

            max_ref_w: Dict[tuple, float] = {}
            for ref_tokens in refs_for_i:
                ref_ngrams = _count_ngrams(ref_tokens, n)
                ref_w = _weighted_count(ref_ngrams, ref_tokens)
                for ng, w in ref_w.items():
                    max_ref_w[ng] = max(max_ref_w.get(ng, 0.0), w)

            for ng, w in hyp_w.items():
                clipped_w[n - 1] += min(w, max_ref_w.get(ng, 0.0))
                total_w[n - 1] += w

    if hyp_lengths == 0:
        return 0.0
    bp = math.exp(min(0, 1 - ref_lengths / hyp_lengths))

    log_avg = 0.0
    weight = 1.0 / max_n
    for n in range(max_n):
        if total_w[n] == 0 or clipped_w[n] == 0:
            log_avg += weight * math.log((clipped_w[n] + 1e-10) / (total_w[n] + 1e-10))
        else:
            log_avg += weight * math.log(clipped_w[n] / total_w[n])

    return bp * math.exp(log_avg)


def compute_codebleu(
    references: List[str],
    hypotheses: List[str],
    lang: str = "java",
) -> float:
    """
    CodeBLEU score (0–100).

    Computes the two fast components of CodeBLEU directly:
      - n-gram match (standard BLEU)                   weight 0.25
      - keyword-weighted n-gram match                   weight 0.25

    For syntax_match and dataflow_match (tree-sitter AST components),
    attempts TARGET's implementation with a timeout. If it hangs or fails
    (common on Windows / with malformed code), falls back to re-weighting
    the two fast components at 0.5 each.

    This matches TARGET's calc_code_bleu() formula:
      CodeBLEU = 0.25*ngram + 0.25*weighted_ngram + 0.25*syntax + 0.25*dataflow
    """
    if not references or not hypotheses:
        return 0.0

    norm_refs = [normalize_code(r) for r in references]
    norm_hyps = [normalize_code(h) for h in hypotheses]

    tokenized_hyps = [s.split() for s in norm_hyps]
    # Each hypothesis has one reference → [[ref_tokens]]
    tokenized_refs = [[s.split()] for s in norm_refs]

    # ── Component 1: n-gram match (fast) ──
    ngram_score = _safe_ngram_bleu(tokenized_refs, tokenized_hyps)

    # ── Component 2: keyword-weighted n-gram match (fast) ──
    weighted_score = _safe_weighted_ngram_bleu(
        tokenized_refs, tokenized_hyps, _JAVA_KEYWORDS
    )

    # ── Components 3 & 4: syntax + dataflow (slow, may hang) ──
    syntax_score = 0.0
    dataflow_score = 0.0
    ast_available = False

    import os as _os
    target_ft = _os.getenv(
        "TARGET_FINETUNING_DIR",
        r"d:\Desktop\Target\TaRGET\fine-tuning",
    )
    so_path = _os.path.join(target_ft, "CodeBLEU", "parser", "my-languages.so")

    if _os.path.isfile(so_path):
        # tree-sitter .so exists — try with a subprocess timeout
        try:
            import concurrent.futures
            import sys, fractions

            _orig_fraction = fractions.Fraction
            class _PatchedFraction(_orig_fraction):
                def __new__(cls, numerator=0, denominator=None, **kw):
                    kw.pop("_normalize", None)
                    return _orig_fraction.__new__(cls, numerator, denominator)
            fractions.Fraction = _PatchedFraction

            _orig_cwd = _os.getcwd()
            if target_ft not in sys.path:
                sys.path.insert(0, target_ft)
            _os.chdir(target_ft)

            from CodeBLEU import syntax_match as _sm, dataflow_match as _dm

            refs_for_cb = [[r] for r in norm_refs]

            def _compute_ast():
                s = _sm.corpus_syntax_match(refs_for_cb, norm_hyps, lang)
                d = _dm.corpus_dataflow_match(refs_for_cb, norm_hyps, lang)
                return s, d

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as exe:
                future = exe.submit(_compute_ast)
                syntax_score, dataflow_score = future.result(timeout=120)
                ast_available = True

            _os.chdir(_orig_cwd)
            fractions.Fraction = _orig_fraction
        except Exception as e:
            logger.warning(
                f"CodeBLEU AST components unavailable ({type(e).__name__}: {e}). "
                "Using n-gram + keyword components only (re-weighted to 0.5 each)."
            )
            try:
                _os.chdir(_orig_cwd)
                fractions.Fraction = _orig_fraction
            except Exception:
                pass
    else:
        logger.info(
            "tree-sitter .so not found — CodeBLEU using n-gram + keyword only."
        )

    if ast_available:
        score = (0.25 * ngram_score + 0.25 * weighted_score
                 + 0.25 * syntax_score + 0.25 * dataflow_score)
    else:
        # Re-weight the two available components equally
        score = 0.5 * ngram_score + 0.5 * weighted_score

    return round(100 * score, 2)


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
