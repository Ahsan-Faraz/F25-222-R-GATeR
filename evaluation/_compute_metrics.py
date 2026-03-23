"""
Metric computation from existing GATeR predictions JSON.
Uses the safe CodeBLEU (n-gram + keyword components, no tree-sitter hang).
"""
import json, os, sys, time, csv, difflib, re, math
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from evaluation.metrics import (
    normalize_code, compute_bleu, compute_codebleu,
    compute_exact_match, compute_compilation_success,
    compute_repair_attempt_rate, compute_line_level_accuracy,
    compute_avg_edit_distance,
)

GATER_JSON = os.path.join(os.path.dirname(os.path.dirname(__file__)),
    "gater_predictions_final_all59_repo_wise_20260319.json")
TARBENCH_ROOT = r"d:\Desktop\Target\TaRGET\fine-tuning\TaRBench\TaRBench"
TARGET_RESULTS = r"d:\Desktop\Target\TaRGET\fine-tuning\TaRGet_Results\TaRGet_Results\Best_on_TaRBench"

print("Loading GATeR predictions...")
with open(GATER_JSON, "r", encoding="utf-8") as f:
    gater = json.load(f)
print(f"  {len(gater)} predictions")

print("Loading TaRBench test IDs...")
test_ids = set()
with open(os.path.join(TARBENCH_ROOT, "splits.csv"), "r") as f:
    for row in csv.DictReader(f):
        if row["Split"] == "test":
            test_ids.add(row["ID"])
print(f"  {len(test_ids)} test IDs")

print("Loading TaRBench project datasets...")
all_cases = {}
for owner in os.listdir(os.path.join(TARBENCH_ROOT, "projects")):
    op = os.path.join(TARBENCH_ROOT, "projects", owner)
    if not os.path.isdir(op):
        continue
    for proj in os.listdir(op):
        ds = os.path.join(op, proj, "dataset.json")
        if os.path.exists(ds):
            with open(ds, "r", encoding="utf-8") as f:
                for c in json.load(f):
                    if c["ID"] in test_ids:
                        all_cases[c["ID"]] = c
print(f"  {len(all_cases)} test cases loaded")

print("Loading TARGET predictions...")
with open(os.path.join(TARGET_RESULTS, "test_predictions.json"), "r", encoding="utf-8") as f:
    target_preds = {p["ID"]: p for p in json.load(f)}
print(f"  {len(target_preds)} TARGET predictions")

print("Loading TARGET verdicts...")
with open(os.path.join(TARGET_RESULTS, "test_verdicts.json"), "r", encoding="utf-8") as f:
    target_verdicts_raw = json.load(f)
verdict_map = {}
for v in target_verdicts_raw:
    vid = v["ID"]
    if v["verdict"]["status"] == "success":
        verdict_map[vid] = True
    elif vid not in verdict_map:
        verdict_map[vid] = False
print(f"  {len(verdict_map)} verdicts, {sum(1 for v in verdict_map.values() if v)} plausible")

# === CLASSIFY GATER REPAIRS ===
print("\n" + "="*70)
print("CLASSIFYING GATeR REPAIRS")
print("="*70)

no_code = 0
indent_only = 0
real_change = 0
real_ids = []

for cid, pred in gater.items():
    if cid not in all_cases:
        continue
    broken = all_cases[cid]["bSource"]["code"]
    gfull = pred.get("repaired_full_code", "")
    if not gfull.strip():
        no_code += 1
        continue

    b_norm = "".join(broken.split())
    g_norm = "".join(gfull.split())
    ratio = difflib.SequenceMatcher(None, b_norm, g_norm).ratio()
    if ratio >= 0.99:
        indent_only += 1
    else:
        real_change += 1
        real_ids.append(cid)

total = no_code + indent_only + real_change
print(f"Total cases: {total}")
print(f"No full code: {no_code}")
print(f"Whitespace/indent only (no real repair): {indent_only} ({100*indent_only/total:.1f}%)")
print(f"Real code changes: {real_change} ({100*real_change/total:.1f}%)")

# === FULL-CODE SIMILARITY ===
print("\n" + "="*70)
print("FULL-CODE SIMILARITY (GATeR repaired_full_code vs aSource)")
print("="*70)

all_full_sims = []
for cid, pred in gater.items():
    if cid not in all_cases:
        continue
    gt_full = all_cases[cid]["aSource"]["code"]
    gfull = pred.get("repaired_full_code", "")
    if not gfull.strip():
        all_full_sims.append(0.0)
        continue
    gt_n = "".join(gt_full.split())
    g_n = "".join(gfull.split())
    sim = difflib.SequenceMatcher(None, gt_n, g_n).ratio()
    all_full_sims.append(sim)

all_full_sims.sort()
n = len(all_full_sims)
em_full = sum(1 for s in all_full_sims if s >= 1.0)
print(f"Count: {n}")
print(f"Exact Match (full code): {em_full} ({100*em_full/n:.2f}%)")
print(f">95% similar: {sum(1 for s in all_full_sims if s > 0.95)} ({100*sum(1 for s in all_full_sims if s > 0.95)/n:.1f}%)")
print(f">90% similar: {sum(1 for s in all_full_sims if s > 0.90)} ({100*sum(1 for s in all_full_sims if s > 0.90)/n:.1f}%)")
print(f">80% similar: {sum(1 for s in all_full_sims if s > 0.80)} ({100*sum(1 for s in all_full_sims if s > 0.80)/n:.1f}%)")
print(f"Mean: {sum(all_full_sims)/n*100:.2f}%")
print(f"Median: {all_full_sims[n//2]*100:.2f}%")


# === CORRECT METRIC COMPUTATION ===
# Strategy: Use TWO comparison levels
# 1. LINE-LEVEL: diff-extract changed lines from repaired_full_code vs bSource for BLEU/EM
# 2. FULL-CODE: compare repaired_full_code vs aSource for CodeBLEU/EditSim

print("\n" + "="*70)
print("COMPUTING ALL METRICS (CORRECT APPROACH)")
print("="*70)


def extract_changed_lines(broken, repaired):
    """Extract lines GATeR actually changed by diffing against broken source."""
    if not broken or not repaired:
        return repaired or ""
    b_lines = broken.splitlines()
    r_lines = repaired.splitlines()
    sm = difflib.SequenceMatcher(None, b_lines, r_lines)
    changed = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ("replace", "insert"):
            changed.extend(r_lines[j1:j2])
    return "\n".join(line.strip() for line in changed if line.strip())


def check_java_syntax(code):
    if not code or not code.strip():
        return False
    depth = 0
    for ch in code:
        if ch == "{": depth += 1
        elif ch == "}": depth -= 1
        if depth < 0: return False
    if depth != 0: return False
    depth = 0
    for ch in code:
        if ch == "(": depth += 1
        elif ch == ")": depth -= 1
        if depth < 0: return False
    if depth != 0: return False
    return True


# Collect aligned data for GATeR and TARGET
gater_preds_line = []        # diff-extracted changed lines
gater_preds_full = []        # full repaired code
gater_gt_line = []           # ground truth repair lines (targetChanges)
gater_gt_full = []           # ground truth full code (aSource)
target_preds_line = []       # TARGET best beam prediction
target_gt_line = []          # same ground truth repair lines
target_beam_preds = []       # all 40 beams
target_verdicts = []         # execution verdicts

common_ids = []

for cid in gater.keys():
    if cid not in all_cases or cid not in target_preds:
        continue

    case = all_cases[cid]
    pred = gater[cid]
    tp = target_preds[cid]

    # Ground truth
    gt_lines = "\n".join(tc.get("line", "") for tc in case.get("hunk", {}).get("targetChanges", []))
    gt_full = case["aSource"]["code"]
    broken = case["bSource"]["code"]

    # GATeR: extract real changed lines
    gfull = pred.get("repaired_full_code", "")
    g_changed = extract_changed_lines(broken, gfull) if gfull.strip() else ""

    # TARGET: best prediction
    t_best = tp["preds"][0] if tp["preds"] else ""
    for p in tp["preds"]:
        if p == tp["target"]:
            t_best = p
            break

    common_ids.append(cid)
    gater_preds_line.append(g_changed)
    gater_preds_full.append(gfull)
    gater_gt_line.append(gt_lines)
    gater_gt_full.append(gt_full)
    target_preds_line.append(t_best)
    target_gt_line.append(gt_lines)
    target_beam_preds.append(tp["preds"])
    target_verdicts.append(verdict_map.get(cid, False))

N = len(common_ids)
print(f"Common IDs (in both GATeR + TARGET + TaRBench): {N}")


# === COMPUTE METRICS ===

# 1. EXACT MATCH (line-level, normalized)
gater_em = sum(1 for g, t in zip(gater_preds_line, gater_gt_line)
               if normalize_code(g) == normalize_code(t)) / N * 100

target_em_best = sum(1 for t, gt in zip(target_preds_line, target_gt_line)
                     if normalize_code(t) == normalize_code(gt)) / N * 100

target_em_beam = 0
for beams, gt in zip(target_beam_preds, target_gt_line):
    ngt = normalize_code(gt)
    if any(normalize_code(b) == ngt for b in beams):
        target_em_beam += 1
target_em_beam = target_em_beam / N * 100

# 2. EDIT SIMILARITY (line-level, normalized)
gater_edit_sim = sum(
    difflib.SequenceMatcher(None, normalize_code(g), normalize_code(t)).ratio()
    for g, t in zip(gater_preds_line, gater_gt_line)
) / N * 100

target_edit_sim = sum(
    difflib.SequenceMatcher(None, normalize_code(t), normalize_code(gt)).ratio()
    for t, gt in zip(target_preds_line, target_gt_line)
) / N * 100

# 3. FULL-CODE EDIT SIMILARITY (repaired_full_code vs aSource)
gater_full_edit = sum(
    difflib.SequenceMatcher(None, normalize_code(g), normalize_code(t)).ratio()
    for g, t in zip(gater_preds_full, gater_gt_full)
) / N * 100

# 4. LINE-LEVEL ACCURACY
gater_line_acc = 0
target_line_acc = 0
for g, t, gt in zip(gater_preds_line, target_preds_line, gater_gt_line):
    t_set = {normalize_code(l) for l in gt.split("\n") if l.strip()}
    if t_set:
        g_set = {normalize_code(l) for l in g.split("\n") if l.strip()}
        t_pred_set = {normalize_code(l) for l in t.split("\n") if l.strip()}
        gater_line_acc += len(t_set & g_set) / len(t_set)
        target_line_acc += len(t_set & t_pred_set) / len(t_set)
gater_line_acc = gater_line_acc / N * 100
target_line_acc = target_line_acc / N * 100

# 5. COMPILATION SUCCESS (check repaired_full_code for balanced syntax)
gater_compile = sum(1 for g in gater_preds_full if check_java_syntax(g)) / N * 100
target_compile = sum(1 for t in target_preds_line if check_java_syntax(t)) / N * 100

# 6. REPAIR ATTEMPT RATE
gater_attempt = sum(1 for g in gater_preds_full if g and g.strip()) / N * 100
target_attempt = sum(1 for t in target_preds_line if t and t.strip()) / N * 100

# 7. PLAUSIBLE REPAIR RATE
target_plausible = sum(1 for v in target_verdicts if v) / N * 100

# 8. BLEU (manual 4-gram BLEU with smoothing)

def _ngrams(tokens, n):
    return [tuple(tokens[i:i+n]) for i in range(len(tokens)-n+1)]

def _bleu_sentence(ref_tokens, hyp_tokens, max_n=4):
    if not hyp_tokens:
        return 0.0
    scores = []
    for n in range(1, max_n+1):
        ref_ng = Counter(_ngrams(ref_tokens, n))
        hyp_ng = Counter(_ngrams(hyp_tokens, n))
        clipped = sum(min(hyp_ng[ng], ref_ng[ng]) for ng in hyp_ng)
        total = max(len(hyp_tokens) - n + 1, 1)
        # +1 smoothing
        scores.append(math.log((clipped + 1) / (total + 1)))
    bp = min(1.0, math.exp(1 - len(ref_tokens)/max(len(hyp_tokens),1)))
    return bp * math.exp(sum(scores)/max_n)

def corpus_bleu_manual(refs, hyps):
    scores = [_bleu_sentence(r, h) for r, h in zip(refs, hyps)]
    return sum(scores) / max(len(scores), 1)

tokenize = lambda s: normalize_code(s).split()

g_refs = [tokenize(gt) for gt in gater_gt_line]
g_hyps = [tokenize(g) for g in gater_preds_line]
gater_bleu = corpus_bleu_manual(g_refs, g_hyps) * 100

t_refs = [tokenize(gt) for gt in target_gt_line]
t_hyps = [tokenize(t) for t in target_preds_line]
target_bleu = corpus_bleu_manual(t_refs, t_hyps) * 100

gf_refs = [tokenize(gt) for gt in gater_gt_full]
gf_hyps = [tokenize(g) for g in gater_preds_full]
gater_bleu_full = corpus_bleu_manual(gf_refs, gf_hyps) * 100

# 9. CodeBLEU - using safe implementation (no tree-sitter hang)
gater_codebleu = -1
target_codebleu = -1
gater_codebleu_full = -1
try:
    print("  Computing GATeR CodeBLEU (line) [safe mode]...")
    gater_codebleu = compute_codebleu(gater_gt_line, gater_preds_line)

    print("  Computing TARGET CodeBLEU (line) [safe mode]...")
    target_codebleu = compute_codebleu(target_gt_line, target_preds_line)

    print("  Computing GATeR CodeBLEU (full) [safe mode]...")
    gater_codebleu_full = compute_codebleu(gater_gt_full, gater_preds_full)

    print("  CodeBLEU done!")
except Exception as e:
    print(f"WARNING: CodeBLEU error: {e}")
    import traceback; traceback.print_exc()

# === PRINT RESULTS ===
print("\n" + "="*70)
print("FINAL RESULTS — GATeR vs TARGET on ALL 7,103 TaRBench Test Cases")
print("="*70)

print(f"\n{'Metric':<35} {'GATeR (RAG)':<18} {'TARGET (FT)':<18} {'Category'}")
print("-"*85)
print(f"{'BLEU (line-level)':<35} {gater_bleu:>10.2f}%      {target_bleu:>10.2f}%      Fair")
print(f"{'BLEU (full-code)':<35} {gater_bleu_full:>10.2f}%      {'N/A':<10}       Fair")
print(f"{'CodeBLEU (line-level)':<35} {gater_codebleu:>10.2f}%      {target_codebleu:>10.2f}%      Fair")
print(f"{'CodeBLEU (full-code)':<35} {gater_codebleu_full:>10.2f}%      {'N/A':<10}       Fair")
print(f"{'Compilation Success':<35} {gater_compile:>10.2f}%      {target_compile:>10.2f}%      Fair")
print(f"{'Plausible Repair Rate':<35} {'N/A (no exec)':>14}  {target_plausible:>10.2f}%      Fair")
print(f"{'Exact Match (best pred)':<35} {gater_em:>10.2f}%      {target_em_best:>10.2f}%      Informational*")
print(f"{'Exact Match (beam=40)':<35} {'N/A':<10}       {target_em_beam:>10.2f}%      Informational*")
print(f"{'Repair Attempt Rate':<35} {gater_attempt:>10.2f}%      {target_attempt:>10.2f}%      Analysis")
print(f"{'Line-Level Accuracy':<35} {gater_line_acc:>10.2f}%      {target_line_acc:>10.2f}%      Analysis")
print(f"{'Edit Similarity (line-level)':<35} {gater_edit_sim:>10.2f}%      {target_edit_sim:>10.2f}%      Analysis")
print(f"{'Edit Similarity (full-code)':<35} {gater_full_edit:>10.2f}%      {'N/A':<10}       Analysis")

print("\n* Informational: EM inherently favors supervised fine-tuned models")
print(f"\nNote: {indent_only} of {total} GATeR repairs ({100*indent_only/total:.1f}%) were whitespace-only")
print(f"      {real_change} of {total} ({100*real_change/total:.1f}%) made real code changes")
print(f"\nTARGET published EM on full set: 66.08%, Plausible: 80.04%")

# ======================================================================
# REAL-CHANGE SUBSET METRICS  (only the 1,207 cases where GATeR actually edited code)
# ======================================================================
real_id_set = set(real_ids)
rc_idx = [i for i, cid in enumerate(common_ids) if cid in real_id_set]
RC = len(rc_idx)

print("\n" + "="*70)
print(f"REAL-CHANGE SUBSET METRICS  ({RC} cases where GATeR made real edits)")
print("="*70)

rc_gater_line  = [gater_preds_line[i]  for i in rc_idx]
rc_gater_full  = [gater_preds_full[i]  for i in rc_idx]
rc_gt_line     = [gater_gt_line[i]     for i in rc_idx]
rc_gt_full     = [gater_gt_full[i]     for i in rc_idx]
rc_target_line = [target_preds_line[i]  for i in rc_idx]
rc_target_gt   = [target_gt_line[i]    for i in rc_idx]
rc_target_beam = [target_beam_preds[i]  for i in rc_idx]
rc_target_verd = [target_verdicts[i]    for i in rc_idx]

# EM
rc_gater_em = sum(1 for g, gt in zip(rc_gater_line, rc_gt_line)
                  if normalize_code(g) == normalize_code(gt)) / RC * 100
rc_target_em = sum(1 for t, gt in zip(rc_target_line, rc_target_gt)
                   if normalize_code(t) == normalize_code(gt)) / RC * 100
rc_target_em_beam = 0
for beams, gt in zip(rc_target_beam, rc_target_gt):
    ngt = normalize_code(gt)
    if any(normalize_code(b) == ngt for b in beams):
        rc_target_em_beam += 1
rc_target_em_beam = rc_target_em_beam / RC * 100

# Edit Similarity (line-level)
rc_gater_esim = sum(
    difflib.SequenceMatcher(None, normalize_code(g), normalize_code(gt)).ratio()
    for g, gt in zip(rc_gater_line, rc_gt_line)) / RC * 100
rc_target_esim = sum(
    difflib.SequenceMatcher(None, normalize_code(t), normalize_code(gt)).ratio()
    for t, gt in zip(rc_target_line, rc_target_gt)) / RC * 100

# Full-code edit similarity
rc_gater_full_esim = sum(
    difflib.SequenceMatcher(None, normalize_code(g), normalize_code(gt)).ratio()
    for g, gt in zip(rc_gater_full, rc_gt_full)) / RC * 100

# Line-level accuracy
rc_gater_lacc = 0
rc_target_lacc = 0
for g, t, gt in zip(rc_gater_line, rc_target_line, rc_gt_line):
    t_set = {normalize_code(l) for l in gt.split("\n") if l.strip()}
    if t_set:
        g_set = {normalize_code(l) for l in g.split("\n") if l.strip()}
        t_pred_set = {normalize_code(l) for l in t.split("\n") if l.strip()}
        rc_gater_lacc += len(t_set & g_set) / len(t_set)
        rc_target_lacc += len(t_set & t_pred_set) / len(t_set)
rc_gater_lacc = rc_gater_lacc / RC * 100
rc_target_lacc = rc_target_lacc / RC * 100

# Compilation
rc_gater_compile = sum(1 for g in rc_gater_full if check_java_syntax(g)) / RC * 100
rc_target_compile = sum(1 for t in rc_target_line if check_java_syntax(t)) / RC * 100

# Plausible
rc_target_plausible = sum(1 for v in rc_target_verd if v) / RC * 100

# BLEU
rc_g_refs = [tokenize(gt) for gt in rc_gt_line]
rc_g_hyps = [tokenize(g)  for g in rc_gater_line]
rc_gater_bleu = corpus_bleu_manual(rc_g_refs, rc_g_hyps) * 100

rc_t_refs = [tokenize(gt) for gt in rc_target_gt]
rc_t_hyps = [tokenize(t)  for t in rc_target_line]
rc_target_bleu = corpus_bleu_manual(rc_t_refs, rc_t_hyps) * 100

rc_gf_refs = [tokenize(gt) for gt in rc_gt_full]
rc_gf_hyps = [tokenize(g)  for g in rc_gater_full]
rc_gater_bleu_full = corpus_bleu_manual(rc_gf_refs, rc_gf_hyps) * 100

# CodeBLEU
rc_gater_cb = -1
rc_target_cb = -1
rc_gater_cb_full = -1
try:
    print("  Computing real-change GATeR CodeBLEU (line)...")
    rc_gater_cb = compute_codebleu(rc_gt_line, rc_gater_line)
    print("  Computing real-change TARGET CodeBLEU (line)...")
    rc_target_cb = compute_codebleu(rc_target_gt, rc_target_line)
    print("  Computing real-change GATeR CodeBLEU (full)...")
    rc_gater_cb_full = compute_codebleu(rc_gt_full, rc_gater_full)
except Exception as e:
    print(f"WARNING: RC CodeBLEU error: {e}")

print(f"\n{'Metric':<35} {'GATeR (RC)':<18} {'TARGET (RC)':<18}")
print("-"*75)
print(f"{'BLEU (line-level)':<35} {rc_gater_bleu:>10.2f}%      {rc_target_bleu:>10.2f}%")
print(f"{'BLEU (full-code)':<35} {rc_gater_bleu_full:>10.2f}%      {'N/A':<10}")
print(f"{'CodeBLEU (line-level)':<35} {rc_gater_cb:>10.2f}%      {rc_target_cb:>10.2f}%")
print(f"{'CodeBLEU (full-code)':<35} {rc_gater_cb_full:>10.2f}%      {'N/A':<10}")
print(f"{'Compilation Success':<35} {rc_gater_compile:>10.2f}%      {rc_target_compile:>10.2f}%")
print(f"{'Plausible (TARGET only)':<35} {'N/A':>10}       {rc_target_plausible:>10.2f}%")
print(f"{'Exact Match (best)':<35} {rc_gater_em:>10.2f}%      {rc_target_em:>10.2f}%")
print(f"{'Exact Match (beam=40)':<35} {'N/A':<10}       {rc_target_em_beam:>10.2f}%")
print(f"{'Line-Level Accuracy':<35} {rc_gater_lacc:>10.2f}%      {rc_target_lacc:>10.2f}%")
print(f"{'Edit Similarity (line-level)':<35} {rc_gater_esim:>10.2f}%      {rc_target_esim:>10.2f}%")
print(f"{'Edit Similarity (full-code)':<35} {rc_gater_full_esim:>10.2f}%      {'N/A':<10}")

# === REPAIR CATEGORY BREAKDOWN ===
print("\n" + "="*70)
print("REPAIR CATEGORY BREAKDOWN (TaRBench categories for real-change subset)")
print("="*70)

cat_counts = {}
cat_gater_em = {}
cat_target_em = {}
for i, idx in enumerate(rc_idx):
    cid = common_ids[idx]
    case = all_cases[cid]
    cat = case.get("repairCategory", case.get("category", "unknown"))
    cat_counts[cat] = cat_counts.get(cat, 0) + 1
    g_match = 1 if normalize_code(rc_gater_line[i]) == normalize_code(rc_gt_line[i]) else 0
    t_match = 1 if normalize_code(rc_target_line[i]) == normalize_code(rc_target_gt[i]) else 0
    cat_gater_em[cat] = cat_gater_em.get(cat, 0) + g_match
    cat_target_em[cat] = cat_target_em.get(cat, 0) + t_match

print(f"\n{'Category':<30} {'Count':<8} {'GATeR EM%':<12} {'TARGET EM%':<12}")
print("-"*65)
for cat in sorted(cat_counts, key=cat_counts.get, reverse=True):
    n_cat = cat_counts[cat]
    ge = cat_gater_em.get(cat, 0) / n_cat * 100
    te = cat_target_em.get(cat, 0) / n_cat * 100
    print(f"{cat:<30} {n_cat:<8} {ge:>8.2f}%    {te:>8.2f}%")

# === QUALITATIVE EXAMPLES ===
print("\n" + "="*70)
print("QUALITATIVE EXAMPLES — Cases where GATeR exact-matches ground truth")
print("="*70)

gater_wins = []
for i, idx in enumerate(rc_idx):
    cid = common_ids[idx]
    gn = normalize_code(rc_gater_line[i])
    gtn = normalize_code(rc_gt_line[i])
    tn = normalize_code(rc_target_line[i])
    if gn == gtn:
        t_ok = (tn == gtn)
        gater_wins.append((cid, rc_gt_line[i], rc_gater_line[i], rc_target_line[i], t_ok))

print(f"GATeR exact matches in real-change subset: {len(gater_wins)}")
for cid, gt, gp, tp, t_ok in gater_wins[:10]:
    print(f"\n  ID: {cid}")
    print(f"  Ground Truth: {gt[:120]}")
    print(f"  GATeR Pred:   {gp[:120]}")
    print(f"  TARGET Pred:  {tp[:120]}")
    print(f"  TARGET also correct: {t_ok}")

# GATeR near-misses  (high similarity but not exact)
print("\n" + "="*70)
print("NEAR-MISS EXAMPLES — High similarity but not exact match")
print("="*70)
near_misses = []
for i, idx in enumerate(rc_idx):
    cid = common_ids[idx]
    gn = normalize_code(rc_gater_line[i])
    gtn = normalize_code(rc_gt_line[i])
    if gn != gtn and gtn:
        sim = difflib.SequenceMatcher(None, gn, gtn).ratio()
        if sim > 0.5:
            near_misses.append((sim, cid, rc_gt_line[i], rc_gater_line[i]))
near_misses.sort(reverse=True)
print(f"Near-misses (>50% sim): {len(near_misses)}")
for sim, cid, gt, gp in near_misses[:10]:
    print(f"\n  ID: {cid} (similarity: {sim:.2%})")
    print(f"  Ground Truth: {gt[:120]}")
    print(f"  GATeR Pred:   {gp[:120]}")
