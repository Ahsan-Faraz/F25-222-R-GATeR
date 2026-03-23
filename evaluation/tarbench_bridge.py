"""
TaRBench ↔ GATeR Bridge
Converts TaRBench test cases into GATeR's input format and extracts
ground-truth repair targets for metric computation.
Also loads TARGET's pre-computed predictions for the same test IDs.
"""

import csv
import json
import logging
import random
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .fair_eval_config import (
    MAX_CASES_PER_PROJECT,
    MIN_PROJECTS_IN_SAMPLE,
    RANDOM_SEED,
    SAMPLE_SIZE,
    STRATIFY_BY_TRIVIAL,
    STRATIFY_BY_VERDICT,
    TARBENCH_PROJECTS_DIR,
    TARBENCH_SPLITS_CSV,
    TARGET_PREDICTIONS_FILE,
    TARGET_VERDICTS_FILE,
)

logger = logging.getLogger("evaluation.bridge")


# ── Load raw TaRBench data ────────────────────────────────────────────────────

def load_tarbench_test_ids() -> set:
    """Return the set of IDs assigned to the 'test' split in splits.csv."""
    test_ids = set()
    with open(TARBENCH_SPLITS_CSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Split"] == "test":
                test_ids.add(row["ID"])
    logger.info(f"Loaded {len(test_ids)} test-split IDs from splits.csv")
    return test_ids


def load_all_project_datasets() -> Dict[str, List[dict]]:
    """Load every per-project dataset.json and index by project key."""
    datasets = {}
    for owner_dir in TARBENCH_PROJECTS_DIR.iterdir():
        if not owner_dir.is_dir():
            continue
        for proj_dir in owner_dir.iterdir():
            ds_file = proj_dir / "dataset.json"
            if ds_file.exists():
                project_key = f"{owner_dir.name}/{proj_dir.name}"
                with open(ds_file, "r", encoding="utf-8") as f:
                    datasets[project_key] = json.load(f)
    logger.info(f"Loaded datasets for {len(datasets)} projects")
    return datasets


def load_tarbench_test_cases() -> List[dict]:
    """
    Combine splits.csv + per-project dataset.json to produce all test-split
    cases with full data (bSource, aSource, hunk, verdict, etc.).
    """
    test_ids = load_tarbench_test_ids()
    datasets = load_all_project_datasets()

    test_cases = []
    for project_key, cases in datasets.items():
        for case in cases:
            if case["ID"] in test_ids:
                case["project"] = project_key
                test_cases.append(case)

    logger.info(f"Matched {len(test_cases)} test-split cases with full data")
    return test_cases


# ── Stratified sampling ───────────────────────────────────────────────────────

def stratified_sample(
    test_cases: List[dict],
    n: int = SAMPLE_SIZE,
    seed: int = RANDOM_SEED,
) -> List[dict]:
    """
    Draw a stratified random sample from the test cases.

    Stratifies by:
      1. verdict type (compile_error vs failure)
      2. trivial flag (True vs False/None)
      3. project (capped per project, ensure diversity)
    """
    rng = random.Random(seed)

    # Group by stratum key
    strata: Dict[str, List[dict]] = defaultdict(list)
    for case in test_cases:
        verdict = case.get("verdict", {}).get("status", "unknown")
        trivial = case.get("trivial")

        v_key = verdict if STRATIFY_BY_VERDICT else "all"
        t_key = str(trivial) if STRATIFY_BY_TRIVIAL else "all"
        strata[f"{v_key}|{t_key}"].append(case)

    # Proportional allocation
    total = len(test_cases)
    sampled = []
    for key, cases in strata.items():
        stratum_n = max(1, round(n * len(cases) / total))
        rng.shuffle(cases)
        sampled.extend(cases[:stratum_n])

    # Enforce project diversity and per-project cap
    proj_counts: Dict[str, int] = defaultdict(int)
    filtered = []
    for case in sampled:
        proj = case["project"]
        if proj_counts[proj] < MAX_CASES_PER_PROJECT:
            filtered.append(case)
            proj_counts[proj] += 1

    # If undersized, fill from remaining cases
    used_ids = {c["ID"] for c in filtered}
    remaining = [c for c in test_cases if c["ID"] not in used_ids]
    rng.shuffle(remaining)

    for case in remaining:
        if len(filtered) >= n:
            break
        proj = case["project"]
        if proj_counts[proj] < MAX_CASES_PER_PROJECT:
            filtered.append(case)
            proj_counts[proj] += 1

    # Ensure minimum project diversity
    if len(proj_counts) < MIN_PROJECTS_IN_SAMPLE:
        # Pull one case from each missing project
        projects_present = set(proj_counts.keys())
        all_projects = {c["project"] for c in test_cases}
        missing = all_projects - projects_present
        for proj in list(missing):
            if len(filtered) >= n:
                break
            proj_cases = [c for c in test_cases if c["project"] == proj and c["ID"] not in used_ids]
            if proj_cases:
                filtered.append(rng.choice(proj_cases))
                proj_counts[proj] += 1

    # Trim to exact n
    filtered = filtered[:n]

    logger.info(
        f"Stratified sample: {len(filtered)} cases across "
        f"{len(set(c['project'] for c in filtered))} projects"
    )
    return filtered


# ── Convert TaRBench → GATeR input ───────────────────────────────────────────

def construct_error_message(case: dict) -> str:
    """
    Construct a meaningful error message from TaRBench metadata.

    TaRBench provides verdict.status and verdict.error_lines but NOT the
    actual compiler/runtime error text.  We synthesise a useful error
    string so GATeR's error parser and LLM prompt have something to work
    with.
    """
    verdict = case.get("verdict", {})
    status = verdict.get("status", "unknown")
    error_lines = verdict.get("error_lines", [])
    hunk = case.get("hunk", {})
    source_changes = hunk.get("sourceChanges", [])

    # Build the failing line(s) from sourceChanges
    failing_lines = []
    for sc in source_changes:
        failing_lines.append(sc.get("line", ""))

    failing_code = " ; ".join(failing_lines) if failing_lines else ""
    line_nums = ", ".join(str(ln) for ln in error_lines) if error_lines else "unknown"
    test_name = case.get("name", "")

    if status == "compile_error":
        msg = (
            f"Java compilation error at line {line_nums} in {test_name}.\n"
            f"Failing code: {failing_code}"
        )
    elif status == "failure":
        msg = (
            f"Test failure at line {line_nums} in {test_name}.\n"
            f"Failing code: {failing_code}"
        )
    else:
        msg = f"{status} at line {line_nums}: {failing_code}"

    return msg


def tarbench_to_gater_input(case: dict) -> Dict:
    """
    Convert one TaRBench test case into the dict that GATREngine.repair_test()
    expects as `broken_test` plus the `error_message` string.

    Now also passes structured change-location data so the LLM prompt can
    highlight exactly which lines are broken and what kind of repair is needed.
    """
    b_source = case.get("bSource", {})
    test_code = b_source.get("code", "")
    test_name = case.get("name", "")
    hunk = case.get("hunk", {})
    verdict = case.get("verdict", {})

    # Extract class and method names
    # name format: "org.example.FooTest.testBar()"
    parts = test_name.rsplit(".", 1)
    test_method = parts[-1].rstrip("()") if parts else test_name
    test_class = parts[0].rsplit(".", 1)[-1] if len(parts) > 1 else ""

    # Structured change-location data for prompt enhancement
    source_changes = hunk.get("sourceChanges", [])
    broken_lines = []
    broken_line_numbers = []
    for sc in source_changes:
        line_text = sc.get("line", "")
        line_no = sc.get("lineNo")
        if line_text:
            broken_lines.append(line_text)
        if line_no is not None:
            broken_line_numbers.append(line_no)

    broken_test = {
        "test_name": test_name,
        "test_code": test_code,
        "test_file": case.get("bPath", ""),
        "test_class": test_class,
        "test_method": test_method,
        "line_number": b_source.get("startLine"),
        "language": "java",
        # Structured change-location metadata for the prompt
        "broken_lines": broken_lines,
        "broken_line_numbers": broken_line_numbers,
        "hunk_type": hunk.get("type", "MODIFY"),
        "verdict_status": verdict.get("status", "unknown"),
        "error_lines": verdict.get("error_lines", []),
        # Extra TaRBench metadata (used by bridge, ignored by GATeR)
        "_tarbench_id": case["ID"],
        "_project": case.get("project", ""),
    }

    error_message = construct_error_message(case)
    return {"broken_test": broken_test, "error_message": error_message}


# ── Extract ground truth ──────────────────────────────────────────────────────

def extract_ground_truth(case: dict) -> Dict:
    """
    Extract the ground-truth repair from a TaRBench case.

    Returns:
        - repaired_lines: the target change lines (what TARGET's output matches)
        - repaired_full_code: the full repaired test method (aSource.code)
    """
    hunk = case.get("hunk", {})
    target_changes = hunk.get("targetChanges", [])
    a_source = case.get("aSource", {})

    # TARGET-style ground truth: the repaired lines joined
    repaired_lines = "\n".join(tc.get("line", "") for tc in target_changes)

    return {
        "repaired_lines": repaired_lines,            # Line-level (for BLEU/EM)
        "repaired_full_code": a_source.get("code", ""),  # Full method (for CodeBLEU)
        "target_changes": target_changes,
        "hunk_type": hunk.get("type", ""),
    }


# ── Load TARGET predictions for subset ────────────────────────────────────────

def load_target_predictions(ids: Optional[set] = None) -> Dict[str, dict]:
    """
    Load TARGET's pre-computed predictions and verdicts, optionally filtered
    to a subset of IDs.

    Returns dict keyed by ID → {target, preds, verdict_success}.
    """
    # Predictions (beam outputs)
    with open(TARGET_PREDICTIONS_FILE, "r", encoding="utf-8") as f:
        all_preds = json.load(f)

    # Verdicts (execution results)
    with open(TARGET_VERDICTS_FILE, "r", encoding="utf-8") as f:
        all_verdicts = json.load(f)

    # Index verdicts by ID → best status
    verdict_map: Dict[str, bool] = {}
    for v in all_verdicts:
        vid = v["ID"]
        if v["verdict"]["status"] == "success":
            verdict_map[vid] = True
        elif vid not in verdict_map:
            verdict_map[vid] = False

    # Build result dict
    result = {}
    for pred in all_preds:
        pid = pred["ID"]
        if ids is not None and pid not in ids:
            continue
        result[pid] = {
            "target": pred["target"],
            "preds": pred["preds"],
            "best_pred": _pick_best_pred(pred["target"], pred["preds"]),
            "exact_match": any(p == pred["target"] for p in pred["preds"]),
            "plausible": verdict_map.get(pid, False),
        }

    logger.info(f"Loaded TARGET predictions for {len(result)} IDs")
    return result


def _pick_best_pred(target: str, preds: List[str]) -> str:
    """Pick best prediction: exact match if present, else first beam output."""
    for p in preds:
        if p == target:
            return p
    return preds[0] if preds else ""


# ── Convenience: build the full evaluation dataset ────────────────────────────

def build_evaluation_dataset(
    sample_size: int = SAMPLE_SIZE,
    seed: int = RANDOM_SEED,
    project_keys: Optional[List[str]] = None,
) -> List[dict]:
    """
    End-to-end: load TaRBench test split → stratified sample → convert for
    both GATeR and TARGET → return unified records.

    Each record contains:
      - id, project, verdict_type, trivial
      - gater_input: {broken_test, error_message}
      - ground_truth: {repaired_lines, repaired_full_code, ...}
      - target_pred: {target, preds, best_pred, exact_match, plausible}
    """
    test_cases = load_tarbench_test_cases()

    if project_keys:
        project_set = {p.strip() for p in project_keys if p and p.strip()}
        test_cases = [c for c in test_cases if c.get("project") in project_set]
        logger.info(
            "Filtered test cases to %d records across %d project(s): %s",
            len(test_cases),
            len(project_set),
            ", ".join(sorted(project_set)),
        )
        if not test_cases:
            raise ValueError("No TaRBench test cases found for requested project filter")

        # Prevent requesting more samples than available after filtering.
        sample_size = min(sample_size, len(test_cases))

    sample = stratified_sample(test_cases, n=sample_size, seed=seed)

    sample_ids = {c["ID"] for c in sample}
    target_preds = load_target_predictions(ids=sample_ids)

    records = []
    for case in sample:
        cid = case["ID"]
        record = {
            "id": cid,
            "project": case.get("project", ""),
            "verdict_type": case.get("verdict", {}).get("status", "unknown"),
            "trivial": case.get("trivial"),
            "gater_input": tarbench_to_gater_input(case),
            "ground_truth": extract_ground_truth(case),
            "target_pred": target_preds.get(cid),
        }
        records.append(record)

    # Stats summary
    with_target = sum(1 for r in records if r["target_pred"] is not None)
    projects = len({r["project"] for r in records})
    logger.info(
        f"Built evaluation dataset: {len(records)} records, "
        f"{projects} projects, {with_target} have TARGET predictions"
    )
    return records
